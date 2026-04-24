import { pgTable, serial, varchar } from "drizzle-orm/pg-core";

export const zonesTable = pgTable("zones", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 16 }).notNull().unique(),
});

export type Zone = typeof zonesTable.$inferSelect;
