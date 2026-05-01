import {
  pgTable,
  pgSequence,
  serial,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Folio público del pedido (PED-NNNNNN). Es independiente del id interno
// (serial PK), para que el cliente y el repartidor identifiquen el envío
// con un número estable y legible.
export const orderFolioSeq = pgSequence("order_folio_seq", { startWith: 1 });

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  // Folio visible: PED-000001, PED-000002, ...
  folio: varchar("folio", { length: 16 }).unique(),
  customerId: integer("customer_id").notNull(),
  pickup: text("pickup").notNull(),
  delivery: text("delivery").notNull(),
  zone: varchar("zone", { length: 32 }),
  payment: varchar("payment", { length: 16 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("PENDIENTE"),
  driverId: integer("driver_id"),
  subscriptionId: integer("subscription_id"),
  deliveryLat: numeric("delivery_lat", { precision: 10, scale: 7 }),
  deliveryLng: numeric("delivery_lng", { precision: 10, scale: 7 }),
  // Datos de contacto y cobro adicionales
  recipientName: varchar("recipient_name", { length: 255 }),
  recipientPhone: varchar("recipient_phone", { length: 64 }),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  cashAmount: numeric("cash_amount", { precision: 12, scale: 2 }),
  cashChange: numeric("cash_change", { precision: 12, scale: 2 }),
  notes: text("notes"),
  // â”€â”€â”€â”€â”€ Liquidación en recolección (pago directo clienteâ†”repartidor) â”€â”€â”€â”€â”€
  // Cuando el repartidor llega a la recolección y el CLIENTE le paga el
  // costo del envío en efectivo en ese momento, el repartidor marca el
  // pedido como "liquidado al recoger". Queda PENDIENTE de aceptación por
  // parte del cliente, que ve un botón en "Mis envíos" para confirmar
  // ("Sí, le pagué") o disputar ("No estoy de acuerdo"). El doble check
  // genera trazabilidad y notificaciones cruzadas.
  pickupSettledAt: timestamp("pickup_settled_at", { withTimezone: true }),
  pickupSettledAmount: numeric("pickup_settled_amount", {
    precision: 12,
    scale: 2,
  }),
  pickupSettledByDriverId: integer("pickup_settled_by_driver_id"),
  pickupSettlementConfirmedAt: timestamp("pickup_settlement_confirmed_at", {
    withTimezone: true,
  }),
  pickupSettlementDisputedAt: timestamp("pickup_settlement_disputed_at", {
    withTimezone: true,
  }),
  pickupSettlementDisputeReason: text("pickup_settlement_dispute_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;
