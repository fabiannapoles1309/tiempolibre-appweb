import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { SubscribeBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const TIERS = {
  ESTANDAR: { monthlyPrice: 15000, monthlyDeliveries: 35 },
  OPTIMO: { monthlyPrice: 25000, monthlyDeliveries: 70 },
} as const;

function serializeSubscription(s: typeof subscriptionsTable.$inferSelect, userName: string) {
  const remaining = Math.max(0, s.monthlyDeliveries - s.usedDeliveries);
  return {
    id: s.id,
    userId: s.userId,
    userName,
    tier: s.tier,
    monthlyPrice: Number(s.monthlyPrice),
    monthlyDeliveries: s.monthlyDeliveries,
    usedDeliveries: s.usedDeliveries,
    remainingDeliveries: remaining,
    periodStart: s.periodStart.toISOString(),
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  };
}

export async function getActiveSubscriptionForUser(userId: number) {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "ACTIVA")))
    .orderBy(desc(subscriptionsTable.createdAt));
  return sub ?? null;
}

router.get("/me/subscription", requireAuth, async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const sub = await getActiveSubscriptionForUser(req.user.sub);
  if (!sub) {
    res.json({ subscription: null });
    return;
  }
  res.json({ subscription: serializeSubscription(sub, (req.user as any).name ?? "Cliente") });
});

router.get(
  "/subscriptions",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({
        sub: subscriptionsTable,
        userName: usersTable.name,
      })
      .from(subscriptionsTable)
      .leftJoin(usersTable, eq(usersTable.id, subscriptionsTable.userId))
      .orderBy(desc(subscriptionsTable.createdAt));
    res.json(rows.map((r) => serializeSubscription(r.sub, r.userName ?? "Cliente")));
  },
);

router.post(
  "/subscriptions/subscribe",
  requireAuth,
  requireRole("CLIENTE", "SUPERUSER"),
  async (req, res): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    const parsed = SubscribeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tierCfg = TIERS[parsed.data.tier as keyof typeof TIERS];
    if (!tierCfg) {
      res.status(400).json({ error: "Tier inválido" });
      return;
    }

    // Cancelar suscripciones activas previas
    await db
      .update(subscriptionsTable)
      .set({ status: "CANCELADA" })
      .where(
        and(
          eq(subscriptionsTable.userId, req.user.sub),
          eq(subscriptionsTable.status, "ACTIVA"),
        ),
      );

    const [sub] = await db
      .insert(subscriptionsTable)
      .values({
        userId: req.user.sub,
        tier: parsed.data.tier,
        monthlyPrice: tierCfg.monthlyPrice.toFixed(2),
        monthlyDeliveries: tierCfg.monthlyDeliveries,
        usedDeliveries: 0,
        status: "ACTIVA",
      })
      .returning();
    if (!sub) {
      res.status(500).json({ error: "No se pudo crear la suscripción" });
      return;
    }
    res.json(serializeSubscription(sub, (req.user as any).name ?? "Cliente"));
  },
);

// Recarga: agrega un bloque de 35 envíos a la última suscripción del cliente.
// Acepta ACTIVA o VENCIDA (el cliente puede recargar cuando se le agotaron envíos).
// Si la sub estaba VENCIDA, la reactiva a ACTIVA.
router.post(
  "/me/subscription/recharge",
  requireAuth,
  requireRole("CLIENTE", "SUPERUSER"),
  async (req, res): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    const [latest] = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.userId, req.user.sub),
          inArray(subscriptionsTable.status, ["ACTIVA", "VENCIDA"]),
        ),
      )
      .orderBy(desc(subscriptionsTable.createdAt));
    if (!latest) {
      res.status(404).json({
        error: "No tenés una suscripción para recargar. Suscribite primero.",
      });
      return;
    }
    const RECHARGE_BLOCK = 35;
    const [updated] = await db
      .update(subscriptionsTable)
      .set({
        monthlyDeliveries: latest.monthlyDeliveries + RECHARGE_BLOCK,
        status: "ACTIVA",
      })
      .where(eq(subscriptionsTable.id, latest.id))
      .returning();
    if (!updated) {
      res.status(500).json({ error: "No se pudo recargar la suscripción" });
      return;
    }
    res.json(serializeSubscription(updated, (req.user as any).name ?? "Cliente"));
  },
);

export default router;
