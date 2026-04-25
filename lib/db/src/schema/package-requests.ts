import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { customersTable } from "./customers";

/**
 * Solicitudes de paquete extra (+35 envíos) hechas por el CLIENTE desde
 * "Mi billetera". Quedan en estado PENDIENTE hasta que un ADMIN o SUPERUSER
 * las aprueba (lo que dispara la recarga real) o las rechaza.
 *
 * Sólo puede haber una solicitud en estado PENDIENTE por cliente a la vez —
 * lo enforzamos con un índice único parcial para que el chequeo sea atómico
 * incluso bajo concurrencia.
 */
export const packageRequestsTable = pgTable(
  "package_requests",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    customerId: integer("customer_id")
      .references(() => customersTable.id, { onDelete: "cascade" })
      .notNull(),
    // PENDIENTE | APROBADA | RECHAZADA
    status: varchar("status", { length: 16 }).notNull().default("PENDIENTE"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processedByUserId: integer("processed_by_user_id").references(
      () => usersTable.id,
    ),
    processedNotes: text("processed_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Una sola solicitud PENDIENTE por usuario, garantizada por la base.
    onePendingPerUser: uniqueIndex("package_requests_one_pending_per_user")
      .on(t.userId)
      .where(sql`status = 'PENDIENTE'`),
  }),
);

export type PackageRequest = typeof packageRequestsTable.$inferSelect;
export type InsertPackageRequest = typeof packageRequestsTable.$inferInsert;
