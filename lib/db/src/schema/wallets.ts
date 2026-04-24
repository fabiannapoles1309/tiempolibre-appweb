import { pgTable, integer, numeric, timestamp, serial, varchar, text } from "drizzle-orm/pg-core";

export const walletsTable = pgTable("wallets", {
  userId: integer("user_id").primaryKey(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const walletTxTable = pgTable("wallet_tx", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Wallet = typeof walletsTable.$inferSelect;
export type WalletTx = typeof walletTxTable.$inferSelect;
