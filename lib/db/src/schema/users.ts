import {
  pgTable,
  pgSequence,
  text,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Folios independientes para clientes (CLI-NNNNNN). El conteo es exclusivo
// de los usuarios con rol CLIENTE y es independiente de la PK interna.
export const customerCodeSeq = pgSequence("customer_code_seq", {
  startWith: 1,
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 16 }).notNull().default("CLIENTE"),
  // Folio público del cliente (sólo para usuarios role=CLIENTE).
  // Formato: CLI-000001, CLI-000002, ...
  customerCode: varchar("customer_code", { length: 16 }).unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
