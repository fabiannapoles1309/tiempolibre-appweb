import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";

// Beneficios concretos asociados a un nivel del programa de repartidores.
// Ej.: "Vales de gasolina" (level=1, icon="fuel"), "Descuento mantenimiento"
// (level=2, icon="wrench"), "Atención médica" (level=3, icon="stethoscope").
export const benefitItemsTable = pgTable("benefit_items", {
  id: serial("id").primaryKey(),
  level: integer("level").notNull(),
  name: varchar("name", { length: 96 }).notNull(),
  icon: varchar("icon", { length: 32 }).notNull().default("gift"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type BenefitItem = typeof benefitItemsTable.$inferSelect;
export type InsertBenefitItem = typeof benefitItemsTable.$inferInsert;
