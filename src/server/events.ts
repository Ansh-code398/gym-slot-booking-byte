import { EventEmitter } from "events";
import { eq, sql } from "drizzle-orm";
import { db, sessions, bookings, waitlist } from "@/db";

export type GymEventType =
  | "booking_created"
  | "booking_cancelled"
  | "check_in"
  | "session_created"
  | "session_updated"
  | "waitlist_updated";

export interface GymEvent {
  type: GymEventType;
  sessionId?: string;
  date?: string;
  timestamp: string;
  data?: {
    confirmedBookingsCount?: number;
    capacity?: number;
    seatsRemaining?: number;
    isFull?: boolean;
    waitlistCount?: number;
    bookingId?: string;
    checkInCode?: string;
    checkedIn?: boolean;
    memberName?: string;
    [key: string]: unknown;
  };
}

class GymEventBus extends EventEmitter {
  constructor() {
    super();
    
    this.setMaxListeners(1000);
  }

  broadcast(event: GymEvent) {
    this.emit("gym-event", event);
  }
}


const globalForEvents = globalThis as unknown as { gymEventBus?: GymEventBus };
export const gymEventBus = globalForEvents.gymEventBus ?? new GymEventBus();
if (process.env.NODE_ENV !== "production") {
  globalForEvents.gymEventBus = gymEventBus;
}


export async function broadcastSessionUpdate(
  sessionId: string,
  eventType: GymEventType = "session_updated",
  extraData?: Record<string, unknown>
) {
  try {
    const [sessionData] = await db
      .select({
        id: sessions.id,
        date: sessions.date,
        startHour: sessions.startHour,
        capacity: sessions.capacity,
        confirmedBookingsCount: sql<number>`count(distinct case when ${bookings.status} = 'confirmed' then ${bookings.id} end)::int`,
        waitlistCount: sql<number>`count(distinct case when ${waitlist.status} = 'waiting' then ${waitlist.id} end)::int`,
      })
      .from(sessions)
      .leftJoin(bookings, eq(bookings.sessionId, sessions.id))
      .leftJoin(waitlist, eq(waitlist.sessionId, sessions.id))
      .where(eq(sessions.id, sessionId))
      .groupBy(sessions.id)
      .limit(1);

    if (!sessionData) return;

    const confirmed = Number(sessionData.confirmedBookingsCount || 0);
    const waitlisted = Number(sessionData.waitlistCount || 0);
    const capacity = Number(sessionData.capacity || 20);
    const seatsRemaining = Math.max(0, capacity - confirmed);
    const isFull = confirmed >= capacity;

    const dateStr = String(sessionData.date || "").split("T")[0];

    gymEventBus.broadcast({
      type: eventType,
      sessionId,
      date: dateStr,
      timestamp: new Date().toISOString(),
      data: {
        confirmedBookingsCount: confirmed,
        capacity,
        seatsRemaining,
        isFull,
        waitlistCount: waitlisted,
        ...(extraData || {}),
      },
    });
  } catch (err) {
    console.error("Failed to broadcast session update:", err);
  }
}
