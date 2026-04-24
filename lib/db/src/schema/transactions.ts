import { pgTable, serial, integer, varchar, numeric, text, timestamp } from "drizzle-orm/pg-core";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  method: varchar("method", { length: 16 }).notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Transaction = typeof transactionsTable.$inferSelect;
export type InsertTransaction = typeof transactionsTable.$inferInsert;
