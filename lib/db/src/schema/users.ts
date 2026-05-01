import {
  pgTable,
  pgSequence,
  text,
  serial,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

export const customerCodeSeq = pgSequence("customer_code_seq", {
  startWith: 1,
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 16 }).notNull().default("CLIENTE"),
  customerCode: varchar("customer_code", { length: 16 }).unique(),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  passwordChangeEnabled: boolean("password_change_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;