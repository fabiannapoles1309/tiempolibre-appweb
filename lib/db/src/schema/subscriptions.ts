import { pgTable, serial, varchar, integer, timestamp, numeric } from "drizzle-orm/pg-core";

// Suscripciones B2B del cliente (paquetes mensuales de envíos).
// Tiers:
//   ESTANDAR — MXN 15,000/mes, 35 envíos incluidos.
//   OPTIMO   — MXN 25,000/mes, 70 envíos incluidos.
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tier: varchar("tier", { length: 16 }).notNull(), // ESTANDAR | OPTIMO
  monthlyPrice: numeric("monthly_price", { precision: 12, scale: 2 }).notNull(),
  monthlyDeliveries: integer("monthly_deliveries").notNull(),
  usedDeliveries: integer("used_deliveries").notNull().default(0),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull().defaultNow(),
  status: varchar("status", { length: 16 }).notNull().default("ACTIVA"), // ACTIVA | CANCELADA | VENCIDA
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = typeof subscriptionsTable.$inferInsert;
