import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

/**
 * Directorio de DESTINATARIOS por cliente. Cada vez que el cliente crea un
 * envío y captura el nombre + teléfono del destinatario, hacemos upsert
 * acá. Esto permite:
 *   - Autollenado en /orders/new cuando el cliente vuelve a usar el mismo
 *     teléfono.
 *   - Visibilidad para ADMIN y SUPERUSER del padrón completo (con su
 *     consentimiento de marketing por SMS y por correo).
 *
 * Único por (customer_id, phone) para que el upsert sea idempotente.
 */
export const recipientsTable = pgTable(
  "recipients",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .references(() => customersTable.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }),
    allowMarketingSms: boolean("allow_marketing_sms").notNull().default(false),
    allowMarketingEmail: boolean("allow_marketing_email")
      .notNull()
      .default(false),
    orderCount: integer("order_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    customerPhoneUnique: uniqueIndex("recipients_customer_phone_unique").on(
      table.customerId,
      table.phone,
    ),
  }),
);

export type Recipient = typeof recipientsTable.$inferSelect;
export type InsertRecipient = typeof recipientsTable.$inferInsert;
