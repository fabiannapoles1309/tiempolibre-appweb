import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Notificaciones in-app dirigidas a un usuario específico. Reemplazan al
 * email best-effort que dependía de SendGrid: cuando un cliente solicita
 * un paquete extra, deja una queja, o un repartidor marca "entrega
 * liquidada en recolección", insertamos una fila acá y la campana del
 * layout muestra el badge con el conteo de no leídas.
 *
 * - `type`: identifica el evento (PACKAGE_REQUEST_NEW, FEEDBACK_NEW,
 *   PICKUP_SETTLEMENT_PROPOSED, PICKUP_SETTLEMENT_CONFIRMED, etc.) â€” la UI
 *   lo usa para elegir el ícono.
 * - `link`: ruta interna a la que navegamos al hacer clic (p.ej.
 *   `/admin/solicitudes-paquetes` o `/orders/123`).
 * - `is_read`: una vez leída, la fila queda en historial â€” no se borra.
 */
export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 48 }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: varchar("link", { length: 255 }),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userUnreadIdx: index("notifications_user_unread_idx").on(
      t.userId,
      t.isRead,
      t.createdAt,
    ),
  }),
);

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;
