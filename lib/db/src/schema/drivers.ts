import { pgTable, serial, varchar, boolean, text, timestamp, integer, numeric, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const driversTable = pgTable("drivers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }).notNull(),
  vehicle: varchar("vehicle", { length: 64 }).notNull(),
  zones: text("zones").array().notNull().default([] as unknown as string[]),
  active: boolean("active").notNull().default(true),
  // Documentación del vehículo
  licensePlate: varchar("license_plate", { length: 16 }),
  circulationCard: varchar("circulation_card", { length: 64 }),
  circulationCardExpiry: date("circulation_card_expiry"),
  // Estado operativo en tiempo real (controlado por el repartidor)
  // ACTIVO = listo para recibir entregas
  // EN_ENTREGA = ocupado en una entrega
  // EN_PAUSA = pausado, no recibe asignaciones
  // INACTIVO = fuera de turno
  status: varchar("status", { length: 16 }).notNull().default("ACTIVO"),
  // Efectivo cobrado pendiente de liquidar al admin (MXN)
  cashPending: numeric("cash_pending", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Driver = typeof driversTable.$inferSelect;
export type InsertDriver = typeof driversTable.$inferInsert;
