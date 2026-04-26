import { pgTable, serial, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull(),
  orderId: integer("order_id"),
  // Tipos: ACCIDENTE, ROBO, DEMORA, CLIENTE_AUSENTE, VEHICULO, OTRO
  type: varchar("type", { length: 32 }).notNull(),
  description: text("description").notNull(),
  // Estado: ABIERTO | EN_REVISION | RESUELTO
  status: varchar("status", { length: 16 }).notNull().default("ABIERTO"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Incident = typeof incidentsTable.$inferSelect;
export type InsertIncident = typeof incidentsTable.$inferInsert;
