import {
  pgTable,
  serial,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { driversTable } from "./drivers";
import { benefitItemsTable } from "./benefit-items";
import { usersTable } from "./users";

// Registro de beneficios efectivamente entregados al repartidor en un mes
// concreto. Si existe un row para (driver, benefitItem, year, month) el
// beneficio se considera ENTREGADO; si no existe pero el driver alcanzó el
// nivel, se muestra como POR_RECLAMAR.
export const benefitClaimsTable = pgTable(
  "benefit_claims",
  {
    id: serial("id").primaryKey(),
    driverId: integer("driver_id")
      .notNull()
      .references(() => driversTable.id, { onDelete: "cascade" }),
    benefitItemId: integer("benefit_item_id")
      .notNull()
      .references(() => benefitItemsTable.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1-12
    deliveredAt: timestamp("delivered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredByUserId: integer("delivered_by_user_id").references(
      () => usersTable.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqClaim: uniqueIndex("benefit_claims_unique_idx").on(
      t.driverId,
      t.benefitItemId,
      t.year,
      t.month,
    ),
  }),
);

export type BenefitClaim = typeof benefitClaimsTable.$inferSelect;
export type InsertBenefitClaim = typeof benefitClaimsTable.$inferInsert;
