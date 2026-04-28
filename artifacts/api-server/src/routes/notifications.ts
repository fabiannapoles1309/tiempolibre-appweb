import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * Lista las últimas N notificaciones del usuario actual + conteo de no
 * leídas. La campana hace polling de este endpoint cada 30s.
 *
 * - `?limit` (default 20, max 100): cuántas filas devolver.
 * - `?onlyUnread=1`: filtra a sólo no leídas.
 */
router.get(
  "/me/notifications",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.sub;
    const limitRaw = Number(req.query.limit ?? 20);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 100);
    const onlyUnread = req.query.onlyUnread === "1" || req.query.onlyUnread === "true";

    const where = onlyUnread
      ? and(
          eq(notificationsTable.userId, userId),
          eq(notificationsTable.isRead, false),
        )
      : eq(notificationsTable.userId, userId);

    const [rows, [{ count: unread }]] = await Promise.all([
      db
        .select()
        .from(notificationsTable)
        .where(where)
        .orderBy(desc(notificationsTable.createdAt))
        .limit(limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, userId),
            eq(notificationsTable.isRead, false),
          ),
        ),
    ]);

    res.json({
      unread: Number(unread ?? 0),
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        link: r.link,
        isRead: r.isRead,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  },
);

/**
 * Marca una notificación como leída. Devuelve 204 incluso si ya estaba
 * leída (idempotente). Sólo el dueño de la notificación puede leerla.
 */
router.patch(
  "/me/notifications/:id/read",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, req.user!.sub),
        ),
      );
    res.status(204).end();
  },
);

/**
 * Marca todas las notificaciones del usuario como leídas. Devuelve cuántas
 * filas se actualizaron (las que estaban no leídas).
 */
router.post(
  "/me/notifications/read-all",
  requireAuth,
  async (req, res): Promise<void> => {
    const updated = await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(
        and(
          eq(notificationsTable.userId, req.user!.sub),
          eq(notificationsTable.isRead, false),
        ),
      )
      .returning({ id: notificationsTable.id });
    res.json({ updated: updated.length });
  },
);

export default router;
