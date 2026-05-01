import { pgTable, varchar, numeric, timestamp } from "drizzle-orm/pg-core";

// Configuración de precios editable por ADMIN/SUPERUSER. Es una tabla
// key-value con claves bien conocidas:
//   ESTANDAR_PRICE       â€” precio mensual del plan Estándar (MXN).
//   OPTIMO_PRICE         â€” precio mensual del plan Óptimo (MXN).
//   EXTRA_PACKAGE_PRICE  â€” costo del paquete extra de 35 envíos (MXN).
// El monto se guarda en `value` como numeric con 2 decimales para mantener
// consistencia con el resto del schema financiero.
export const pricingSettingsTable = pgTable("pricing_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PricingSetting = typeof pricingSettingsTable.$inferSelect;
export type InsertPricingSetting = typeof pricingSettingsTable.$inferInsert;

export const PRICING_KEYS = {
  ESTANDAR_PRICE: "ESTANDAR_PRICE",
  OPTIMO_PRICE: "OPTIMO_PRICE",
  EXTRA_PACKAGE_PRICE: "EXTRA_PACKAGE_PRICE",
} as const;

export const PRICING_DEFAULTS = {
  ESTANDAR_PRICE: 15000,
  OPTIMO_PRICE: 25000,
  EXTRA_PACKAGE_PRICE: 15000,
} as const;
