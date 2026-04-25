import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";

// Configuración por nivel de beneficios para repartidores.
// El admin define cuántas entregas se necesitan para desbloquear cada nivel.
export const benefitsConfigTable = pgTable("benefits_config", {
  id: serial("id").primaryKey(),
  level: integer("level").notNull().unique(), // 1, 2, 3, ...
  name: varchar("name", { length: 64 }).notNull(),
  deliveriesRequired: integer("deliveries_required").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type BenefitsConfig = typeof benefitsConfigTable.$inferSelect;
export type InsertBenefitsConfig = typeof benefitsConfigTable.$inferInsert;
