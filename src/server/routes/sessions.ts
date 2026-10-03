import { Elysia, t } from "elysia";
import { eq, and, sql, asc, or } from "drizzle-orm";
import { db, sessions, bookings, waitlist, users } from "@/db";
import { authMiddleware } from "../middleware/auth";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../errors";
import {
  isSessionEnded,
  isSessionStarted,
  isSessionActive,
  isSessionUpcoming,
} from "@/lib/session-time";

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
    async ({ query, getCurrentUser }) => {
      const user = await getCurrentUser();

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
        .orderBy(asc(sessions.date), asc(sessions.startHour));

      
      const userBookings = user
        ? await db
            .select({
              id: bookings.id,
              sessionId: bookings.sessionId,
              status: bookings.status,
              checkInCode: bookings.checkInCode,
              checkedIn: bookings.checkedIn,
            })
            .from(bookings)
            .where(and(eq(bookings.userId, user.id), eq(bookings.status, "confirmed")))
        : [];

      const userWaitlists = user
        ? await db
            .select({
              id: waitlist.id,
              sessionId: waitlist.sessionId,
              status: waitlist.status,
            })
            .from(waitlist)
            .where(and(eq(waitlist.userId, user.id), eq(waitlist.status, "waiting")))
        : [];

      const userBookingMap = new Map(userBookings.map((b) => [b.sessionId, b]));
      const userWaitlistMap = new Map(userWaitlists.map((w) => [w.sessionId, w]));

      const now = new Date();

      let formatted = rawSessions.map((s) => {
        const confirmed = Number(s.confirmedBookingsCount || 0);
        const waitlisted = Number(s.waitlistCount || 0);
        const seatsRemaining = Math.max(0, s.capacity - confirmed);
        const isFull = confirmed >= s.capacity;
        const sessionSource = { date: s.date, startHour: s.startHour, startTime: s.startTime };
        const hasStarted = isSessionStarted(sessionSource, now);
        const hasEnded = isSessionEnded(sessionSource, now);
        const isCurrentlyActive = isSessionActive(sessionSource, now);
        const myBooking = userBookingMap.get(s.id) || null;
        const myWaitlist = userWaitlistMap.get(s.id) || null;

        return {
          ...s,
          confirmedBookingsCount: confirmed,
          waitlistCount: waitlisted,
          seatsRemaining,
          isFull,
          hasStarted,
          hasEnded,
          isCurrentlyActive,
          myBooking,
          myWaitlist,
          isBookedByMe: !!myBooking,
          isWaitlistedByMe: !!myWaitlist,
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
    "/my-bookings",
    async ({ requireAuth }) => {
      const user = await requireAuth();

      const userBookings = await db
        .select({
          bookingId: bookings.id,
          checkInCode: bookings.checkInCode,
          checkedIn: bookings.checkedIn,
          checkedInAt: bookings.checkedInAt,
          status: bookings.status,
          bookingCreatedAt: bookings.createdAt,
          sessionId: sessions.id,
          date: sessions.date,
          startHour: sessions.startHour,
          startTime: sessions.startTime,
          capacity: sessions.capacity,
        })
        .from(bookings)
        .innerJoin(sessions, eq(sessions.id, bookings.sessionId))
        .where(and(eq(bookings.userId, user.id), eq(bookings.status, "confirmed")))
        .orderBy(asc(sessions.startTime));

      const now = new Date();
      const enriched = userBookings.map((b) => {
        const sessionSource = { date: b.date, startHour: b.startHour, startTime: b.startTime };
        return {
          ...b,
          hasStarted: isSessionStarted(sessionSource, now),
          hasEnded: isSessionEnded(sessionSource, now),
          isUpcoming: isSessionUpcoming(sessionSource, now),
          isActive: isSessionActive(sessionSource, now),
        };
      });

      const userWaitlistEntries = await db
        .select({
          waitlistId: waitlist.id,
          status: waitlist.status,
          createdAt: waitlist.createdAt,
          sessionId: sessions.id,
          date: sessions.date,
          startHour: sessions.startHour,
          startTime: sessions.startTime,
          capacity: sessions.capacity,
        })
        .from(waitlist)
        .innerJoin(sessions, eq(sessions.id, waitlist.sessionId))
        .where(and(eq(waitlist.userId, user.id), eq(waitlist.status, "waiting")))
        .orderBy(asc(sessions.startTime));

      return {
        success: true,
        bookings: enriched,
        waitlist: userWaitlistEntries,
      };
    }
  )
  .post(
    "/:id/book",
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

      const now = new Date();
      if (isSessionStarted(session, now)) {
        throw new BadRequestError("Cannot book a session that has already started or ended.");
      }

      
      const [existingBooking] = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.sessionId, id),
            eq(bookings.userId, user.id),
            eq(bookings.status, "confirmed")
          )
        )
        .limit(1);

      if (existingBooking) {
        throw new ConflictError("You have already booked this session.");
      }

      
      const [overlappingBooking] = await db
        .select({ id: bookings.id })
        .from(bookings)
        .innerJoin(sessions, eq(sessions.id, bookings.sessionId))
        .where(
          and(
            eq(bookings.userId, user.id),
            eq(bookings.status, "confirmed"),
            eq(sessions.date, session.date),
            eq(sessions.startHour, session.startHour)
          )
        )
        .limit(1);

      if (overlappingBooking) {
        throw new ConflictError("You already have a booking for another session at this time.");
      }

      
      const [countResult] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .where(and(eq(bookings.sessionId, id), eq(bookings.status, "confirmed")));

      const confirmedCount = Number(countResult?.count || 0);

     
      if (confirmedCount < session.capacity) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let checkInCode = "";
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
          attempts++;
          checkInCode = Array.from({ length: 6 }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
          ).join("");

          const [existingCode] = await db
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.checkInCode, checkInCode))
            .limit(1);

          if (!existingCode) {
            isUnique = true;
          }
        }

        const [newBooking] = await db
          .insert(bookings)
          .values({
            sessionId: id,
            userId: user.id,
            status: "confirmed",
            checkInCode,
            checkedIn: false,
          })
          .returning();

        await db
          .delete(waitlist)
          .where(and(eq(waitlist.sessionId, id), eq(waitlist.userId, user.id)));

        return {
          success: true,
          isWaitlist: false,
          booking: newBooking,
          message: `Slot booked successfully! Your check-in code is ${newBooking.checkInCode}.`,
        };
      }

      
      const [existingWaitlist] = await db
        .select({ id: waitlist.id })
        .from(waitlist)
        .where(
          and(
            eq(waitlist.sessionId, id),
            eq(waitlist.userId, user.id),
            eq(waitlist.status, "waiting")
          )
        )
        .limit(1);

      if (existingWaitlist) {
        throw new ConflictError("You are already on the waitlist for this session.");
      }

      const [newWaitlist] = await db
        .insert(waitlist)
        .values({
          sessionId: id,
          userId: user.id,
          status: "waiting",
        })
        .returning();

      const [waitlistCountResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(waitlist)
        .where(and(eq(waitlist.sessionId, id), eq(waitlist.status, "waiting")));

      const position = Number(waitlistCountResult?.count || 1);

      return {
        success: true,
        isWaitlist: true,
        waitlist: newWaitlist,
        position,
        message: `Session is full. You've been placed on the waitlist (Position #${position}).`,
      };
    }
  )
  .post(
    "/:id/cancel",
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

      if (isSessionEnded(session, new Date())) {
        throw new BadRequestError("Cannot cancel a booking or waitlist entry for a session that has already ended.");
      }

      const [booking] = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.sessionId, id),
            eq(bookings.userId, user.id),
            eq(bookings.status, "confirmed")
          )
        )
        .limit(1);

      if (booking) {
        if (booking.checkedIn) {
          throw new BadRequestError("Cannot cancel a booking that has already been checked in.");
        }

        await db
          .update(bookings)
          .set({ status: "cancelled" })
          .where(eq(bookings.id, booking.id));

        const [nextInLine] = await db
          .select({
            id: waitlist.id,
            userId: waitlist.userId,
          })
          .from(waitlist)
          .where(and(eq(waitlist.sessionId, id), eq(waitlist.status, "waiting")))
          .orderBy(asc(waitlist.createdAt))
          .limit(1);

        if (nextInLine) {
          await db
            .update(waitlist)
            .set({ status: "promoted" })
            .where(eq(waitlist.id, nextInLine.id));

          const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
          let promotedCode = "";
          let isUnique = false;
          let attempts = 0;

          while (!isUnique && attempts < 10) {
            attempts++;
            promotedCode = Array.from({ length: 6 }, () =>
              chars.charAt(Math.floor(Math.random() * chars.length))
            ).join("");

            const [existingCode] = await db
              .select({ id: bookings.id })
              .from(bookings)
              .where(eq(bookings.checkInCode, promotedCode))
              .limit(1);

            if (!existingCode) {
              isUnique = true;
            }
          }

          await db.insert(bookings).values({
            sessionId: id,
            userId: nextInLine.userId,
            status: "confirmed",
            checkInCode: promotedCode,
            checkedIn: false,
          });
        }

        return {
          success: true,
          message: "Your booking has been cancelled.",
        };
      }

      const [waitlistEntry] = await db
        .select()
        .from(waitlist)
        .where(
          and(
            eq(waitlist.sessionId, id),
            eq(waitlist.userId, user.id),
            eq(waitlist.status, "waiting")
          )
        )
        .limit(1);

      if (waitlistEntry) {
        await db
          .update(waitlist)
          .set({ status: "cancelled" })
          .where(eq(waitlist.id, waitlistEntry.id));

        return {
          success: true,
          message: "You have been removed from the waitlist.",
        };
      }

      throw new NotFoundError("No active booking or waitlist entry found for this session.");
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
      const now = new Date();

      return {
        success: true,
        session: {
          ...session,
          confirmedBookingsCount: confirmedCount,
          seatsRemaining,
          isFull: confirmedCount >= session.capacity,
          hasStarted: isSessionStarted(session, now),
          hasEnded: isSessionEnded(session, now),
          isCurrentlyActive: isSessionActive(session, now),
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
      const sessionTiming = {
        date: "",
        startHour: 0,
        startTime: booking.sessionStartTime,
      };

      if (isSessionUpcoming(sessionTiming, now)) {
        const sessionStart = new Date(booking.sessionStartTime);
        throw new BadRequestError(
          `Check-in has not opened yet. Session starts at ${sessionStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
        );
      }

      if (isSessionEnded(sessionTiming, now)) {
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
