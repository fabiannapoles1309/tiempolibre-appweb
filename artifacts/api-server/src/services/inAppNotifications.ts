/**
 * In-app notifications: persistencia simple en `notifications` para que la
 * campana del layout muestre el badge sin depender de SendGrid/SMTP.
 *
 * Diseño:
 * - `notifyUsers` recibe lista de `userId`s e inserta una fila por cada uno.
 * - Es siempre best-effort: si la inserción falla, lo logueamos y seguimos
 *   (no rompemos el flujo principal — p.ej. crear una solicitud de paquete
 *   no debe abortarse porque la notificación falle).
 * - `notifyByRole` resuelve por rol (ADMIN/SUPERUSER) y delega.
 */

import { inArray } from "drizzle-orm";
import { db, notificationsTable, usersTable } from "@workspace/db";

export type NotificationType =
  // Admin/Superuser
  | "PACKAGE_REQUEST_NEW"
  | "FEEDBACK_NEW"
  | "INCIDENT_NEW"
  | "PICKUP_SETTLEMENT_DISPUTED"
  // Cliente
  | "PACKAGE_REQUEST_APPROVED"
  | "PACKAGE_REQUEST_REJECTED"
  | "PACKAGE_ASSIGNED_BY_ADMIN"
  | "PICKUP_SETTLEMENT_PROPOSED"
  // Driver
  | "PICKUP_SETTLEMENT_CONFIRMED"
  | "PICKUP_SETTLEMENT_DISPUTED_BY_CUSTOMER";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Inserta una notificación in-app para cada `userId` indicado.
 * No lanza nunca: cualquier error se registra y se traga.
 */
export async function notifyUsers(
  userIds: number[],
  payload: NotificationPayload,
): Promise<void> {
  const ids = Array.from(new Set(userIds.filter((n) => Number.isFinite(n))));
  if (ids.length === 0) return;
  try {
    await db.insert(notificationsTable).values(
      ids.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        link: payload.link ?? null,
      })),
    );
  } catch (err) {
    console.error("[notify] insert failed", { type: payload.type, err });
  }
}

/**
 * Notifica a todos los usuarios con uno de los roles indicados.
 * Útil para el patrón "avisar a los admins" sin duplicar la query.
 */
export async function notifyByRole(
  roles: Array<"SUPERUSER" | "ADMIN" | "CLIENTE" | "DRIVER">,
  payload: NotificationPayload,
): Promise<void> {
  try {
    const rows = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(inArray(usersTable.role, roles));
    if (rows.length === 0) return;
    await notifyUsers(
      rows.map((r) => r.id),
      payload,
    );
  } catch (err) {
    console.error("[notify] role lookup failed", { roles, err });
  }
}
