import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  pickup: text("pickup").notNull(),
  delivery: text("delivery").notNull(),
  zone: varchar("zone", { length: 16 }).notNull(),
  payment: varchar("payment", { length: 16 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("PENDIENTE"),
  driverId: integer("driver_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;
