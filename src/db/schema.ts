import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";


export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});


export const sessions = pgTable(
  "sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    date: text("date").notNull(),
    startHour: integer("startHour").notNull(),
    startTime: timestamp("startTime", { withTimezone: true }).notNull().unique(),
    capacity: integer("capacity").notNull().default(20),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("session_date_hour_idx").on(table.date, table.startHour),
  ]
);


export const bookings = pgTable(
  "bookings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("sessionId")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("confirmed"),
    checkInCode: text("checkInCode").notNull().unique(),
    checkedIn: boolean("checkedIn").notNull().default(false),
    checkedInAt: timestamp("checkedInAt", { withTimezone: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("active_booking_per_user_idx")
      .on(table.sessionId, table.userId)
      .where(sql`"status" = 'confirmed'`),
  ]
);


export const waitlist = pgTable(
  "waitlist",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("sessionId")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("waiting"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("active_waitlist_per_user_idx")
      .on(table.sessionId, table.userId)
      .where(sql`"status" = 'waiting'`),
  ]
);


export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  waitlist: many(waitlist),
}));

export const sessionsRelations = relations(sessions, ({ many }) => ({
  bookings: many(bookings),
  waitlist: many(waitlist),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  session: one(sessions, {
    fields: [bookings.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
}));

export const waitlistRelations = relations(waitlist, ({ one }) => ({
  session: one(sessions, {
    fields: [waitlist.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [waitlist.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type WaitlistEntry = typeof waitlist.$inferSelect;
export type NewWaitlistEntry = typeof waitlist.$inferInsert;