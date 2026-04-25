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
  zone: varchar("zone", { length: 32 }),
  payment: varchar("payment", { length: 16 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("PENDIENTE"),
  driverId: integer("driver_id"),
  deliveryLat: numeric("delivery_lat", { precision: 10, scale: 7 }),
  deliveryLng: numeric("delivery_lng", { precision: 10, scale: 7 }),
  // Datos de contacto y cobro adicionales
  recipientName: varchar("recipient_name", { length: 255 }),
  recipientPhone: varchar("recipient_phone", { length: 64 }),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  cashAmount: numeric("cash_amount", { precision: 12, scale: 2 }),
  cashChange: numeric("cash_change", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;
