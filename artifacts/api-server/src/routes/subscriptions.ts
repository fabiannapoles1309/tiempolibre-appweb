import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, subscriptionsTable, usersTable, customersTable } from "@workspace/db";
import { SubscribeBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

// Los planes ya NO incluyen envíos por defecto: el cliente compra
// paquetes extras de 35 envíos cuando los necesita. El tier sólo
// determina la categoría de servicio (perks). El cargo recurrente
// del plan se eliminó: monthlyPrice fijo en 0. El único valor
// monetario vivo es `extraPackagePrice` en `pricing_settings`.
const TIER_DELIVERIES = {
  ESTANDAR: 0,
  OPTIMO: 0,
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

router.get("/me/customer", requireAuth, async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const [c] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.userId, req.user.sub));
  res.json({
    businessName: c?.businessName ?? null,
    pickupAddress: c?.pickupAddress ?? null,
    clienteZone: c?.zone ?? null,
    phone: c?.phone ?? null,
  });
});

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
    const tier = parsed.data.tier as keyof typeof TIER_DELIVERIES;
    const monthlyDeliveries = TIER_DELIVERIES[tier];
    if (monthlyDeliveries == null) {
      res.status(400).json({ error: "Tier inválido" });
      return;
    }
    // Los planes son tiers gratuitos (sin cargo mensual): la única
    // facturación viva ocurre al asignar/aprobar paquetes extras.
    const monthlyPrice = 0;

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
        monthlyPrice: monthlyPrice.toFixed(2),
        monthlyDeliveries,
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

// La autorrecarga del cliente fue eliminada (M1): solo el ADMIN puede agregar
// bloques de 35 envíos vía /admin/clientes/:id/recharge. El endpoint queda
// bloqueado de forma explícita para cualquier rol.
router.post(
  "/me/subscription/recharge",
  requireAuth,
  async (_req, res): Promise<void> => {
    res.status(403).json({
      error:
        "La recarga es exclusiva del administrador. Contacta a tu ejecutivo.",
    });
  },
);

export default router;
