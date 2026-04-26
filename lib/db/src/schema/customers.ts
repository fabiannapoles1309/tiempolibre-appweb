import { pgTable, serial, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull().unique(),
  businessName: varchar("business_name", { length: 255 }),
  pickupAddress: text("pickup_address"),
  zone: integer("zone"),
  phone: varchar("phone", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Customer = typeof customersTable.$inferSelect;
export type InsertCustomer = typeof customersTable.$inferInsert;
