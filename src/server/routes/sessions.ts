import { Elysia, t } from "elysia";
import { eq, and, sql, asc, or } from "drizzle-orm";
import { db, sessions, bookings, waitlist, users } from "@/db";
import { authMiddleware } from "../middleware/auth";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../errors";

export const sessionsRoutes = new Elysia({ prefix: "/sessions" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, requireAdmin }) => {
      await requireAdmin();

      const { date, startHour, capacity = 20 } = body;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestError("Date must be in YYYY-MM-DD format");
      }

      if (startHour < 0 || startHour > 23) {
        throw new BadRequestError("Start hour must be between 0 and 23");
      }

      const hourPadded = String(startHour).padStart(2, "0");
      const startTime = body.startTime
        ? new Date(body.startTime)
        : new Date(`${date}T${hourPadded}:00:00.000Z`);

      const now = new Date();
      if (startTime <= now) {
        throw new BadRequestError(
          "Cannot create a session in the past. Please select an upcoming date and time."
        );
      }

      const [existing] = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          or(
            eq(sessions.startTime, startTime),
            and(eq(sessions.date, date), eq(sessions.startHour, startHour))
          )
        )
        .limit(1);

      if (existing) {
        throw new ConflictError("A session already exists at this start time.");
      }

      const [newSession] = await db
        .insert(sessions)
        .values({
          date,
          startHour,
          startTime,
          capacity: capacity || 20,
        })
        .returning();

      return {
        success: true,
        message: "Session created successfully",
        session: newSession,
      };
    },
    {
      body: t.Object({
        date: t.String({ minLength: 10, maxLength: 10 }),
        startHour: t.Integer({ minimum: 0, maximum: 23 }),
        capacity: t.Optional(t.Integer({ minimum: 1, default: 20 })),
        startTime: t.Optional(t.String()),
      }),
    }
  )
  .get(
    "/",
    async ({ query, requireAuth }) => {
      await requireAuth();

      const { date, availableOnly } = query;
      const conditions = [];

      if (date) {
        conditions.push(eq(sessions.date, date));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rawSessions = await db
        .select({
          id: sessions.id,
          date: sessions.date,
          startHour: sessions.startHour,
          startTime: sessions.startTime,
          capacity: sessions.capacity,
          createdAt: sessions.createdAt,
          confirmedBookingsCount: sql<number>`count(distinct case when ${bookings.status} = 'confirmed' then ${bookings.id} end)::int`,
          waitlistCount: sql<number>`count(distinct case when ${waitlist.status} = 'waiting' then ${waitlist.id} end)::int`,
        })
        .from(sessions)
        .leftJoin(bookings, eq(bookings.sessionId, sessions.id))
        .leftJoin(waitlist, eq(waitlist.sessionId, sessions.id))
        .where(whereClause)
        .groupBy(sessions.id)
        .orderBy(asc(sessions.startTime));

      const now = new Date();

      let formatted = rawSessions.map((s) => {
        const confirmed = Number(s.confirmedBookingsCount || 0);
        const waitlisted = Number(s.waitlistCount || 0);
        const seatsRemaining = Math.max(0, s.capacity - confirmed);
        const isFull = confirmed >= s.capacity;
        const sessionStart = new Date(s.startTime);
        const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000);
        const hasStarted = now >= sessionStart;
        const hasEnded = now >= sessionEnd;
        const isCurrentlyActive = hasStarted && !hasEnded;

        return {
          ...s,
          confirmedBookingsCount: confirmed,
          waitlistCount: waitlisted,
          seatsRemaining,
          isFull,
          hasStarted,
          hasEnded,
          isCurrentlyActive,
        };
      });

      if (availableOnly === "true" || availableOnly === true) {
        formatted = formatted.filter((s) => s.seatsRemaining > 0 && !s.hasEnded);
      }

      return {
        success: true,
        sessions: formatted,
      };
    },
    {
      query: t.Object({
        date: t.Optional(t.String()),
        availableOnly: t.Optional(t.Union([t.String(), t.Boolean()])),
      }),
    }
  )
  .get(
    "/:id",
    async ({ params: { id }, requireAuth }) => {
      const user = await requireAuth();

      const [session] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, id))
        .limit(1);

      if (!session) {
        throw new NotFoundError("Session not found");
      }

      let sessionBookings: Array<{
        id: string;
        checkInCode: string;
        checkedIn: boolean;
        checkedInAt: Date | null;
        status: string;
        user: { id: string; name: string; email: string };
      }> = [];

      let sessionWaitlist: Array<{
        id: string;
        status: string;
        createdAt: Date;
        user: { id: string; name: string; email: string };
      }> = [];

      if (user.role === "admin") {
        sessionBookings = await db
          .select({
            id: bookings.id,
            checkInCode: bookings.checkInCode,
            checkedIn: bookings.checkedIn,
            checkedInAt: bookings.checkedInAt,
            status: bookings.status,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
            },
          })
          .from(bookings)
          .innerJoin(users, eq(users.id, bookings.userId))
          .where(and(eq(bookings.sessionId, id), eq(bookings.status, "confirmed")))
          .orderBy(asc(bookings.createdAt));

        sessionWaitlist = await db
          .select({
            id: waitlist.id,
            status: waitlist.status,
            createdAt: waitlist.createdAt,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
            },
          })
          .from(waitlist)
          .innerJoin(users, eq(users.id, waitlist.userId))
          .where(and(eq(waitlist.sessionId, id), eq(waitlist.status, "waiting")))
          .orderBy(asc(waitlist.createdAt));
      }

      const confirmedCount = sessionBookings.length;
      const seatsRemaining = Math.max(0, session.capacity - confirmedCount);

      return {
        success: true,
        session: {
          ...session,
          confirmedBookingsCount: confirmedCount,
          seatsRemaining,
          isFull: confirmedCount >= session.capacity,
          bookings: sessionBookings,
          waitlist: sessionWaitlist,
        },
      };
    }
  )
  .post(
    "/check-in",
    async ({ body, requireAdmin }) => {
      await requireAdmin();

      const code = body.code.trim().toUpperCase();

      const [booking] = await db
        .select({
          id: bookings.id,
          sessionId: bookings.sessionId,
          userId: bookings.userId,
          status: bookings.status,
          checkedIn: bookings.checkedIn,
          checkedInAt: bookings.checkedInAt,
          checkInCode: bookings.checkInCode,
          sessionStartTime: sessions.startTime,
          userName: users.name,
          userEmail: users.email,
        })
        .from(bookings)
        .innerJoin(sessions, eq(sessions.id, bookings.sessionId))
        .innerJoin(users, eq(users.id, bookings.userId))
        .where(eq(bookings.checkInCode, code))
        .limit(1);

      if (!booking) {
        throw new NotFoundError("Invalid check-in code. No booking found with this code.");
      }

      if (booking.status === "cancelled") {
        throw new BadRequestError("Cannot check in: this booking was cancelled.");
      }

      if (booking.checkedIn) {
        throw new ConflictError(
          `Member ${booking.userName} (${booking.userEmail}) is already checked in.`
        );
      }

      const now = new Date();
      const sessionStart = new Date(booking.sessionStartTime);
      const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000);

      if (now < sessionStart) {
        throw new BadRequestError(
          `Check-in has not opened yet. Session starts at ${sessionStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
        );
      }

      if (now >= sessionEnd) {
        throw new BadRequestError("Check-in has closed. This session has already ended.");
      }

      const nowTimestamp = new Date();
      await db
        .update(bookings)
        .set({
          checkedIn: true,
          checkedInAt: nowTimestamp,
        })
        .where(eq(bookings.id, booking.id));

      return {
        success: true,
        message: `Successfully checked in ${booking.userName}`,
        booking: {
          id: booking.id,
          userName: booking.userName,
          userEmail: booking.userEmail,
          checkedIn: true,
          checkedInAt: nowTimestamp,
        },
      };
    },
    {
      body: t.Object({
        code: t.String({ minLength: 4, maxLength: 10, error: "Check-in code is required" }),
      }),
    }
  );
