import { pgTable, serial, varchar, boolean, text, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const driversTable = pgTable("drivers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }).notNull(),
  vehicle: varchar("vehicle", { length: 64 }).notNull(),
  zones: text("zones").array().notNull().default([] as unknown as string[]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Driver = typeof driversTable.$inferSelect;
export type InsertDriver = typeof driversTable.$inferInsert;
