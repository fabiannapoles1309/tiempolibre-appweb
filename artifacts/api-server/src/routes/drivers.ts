import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, driversTable, ordersTable } from "@workspace/db";
import {
  CreateDriverBody,
  UpdateDriverBody,
  UpdateMyDriverStatusBody,
  SettleDriverCashBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function serialize(d: typeof driversTable.$inferSelect) {
  return {
    id: d.id,
    // Folio público del repartidor (REP-NNNNNN). Estable e independiente del id interno.
    driverCode: d.driverCode ?? null,
    userId: d.userId,
    name: d.name,
    phone: d.phone,
    vehicle: d.vehicle,
    zones: d.zones,
    active: d.active,
    licensePlate: d.licensePlate,
    circulationCard: d.circulationCard,
    circulationCardExpiry: d.circulationCardExpiry,
    status: d.status,
    cashPending: Number(d.cashPending),
    createdAt: d.createdAt.toISOString(),
  };
}

// Genera el siguiente folio de repartidor usando la secuencia dedicada.
// Devuelve "REP-000042". Atómico frente a creaciones concurrentes.
async function nextDriverCode(): Promise<string> {
  const result = await db.execute<{ code: string }>(
    sql`SELECT 'REP-' || lpad(nextval('driver_code_seq')::text, 6, '0') AS code`,
  );
  const row =
    (result as unknown as { rows?: { code: string }[] }).rows?.[0] ??
    (Array.isArray(result) ? (result as any[])[0] : undefined);
  if (!row?.code) throw new Error("No se pudo generar driver_code");
  return row.code;
}

// =============== RANKING (declared first so /drivers/:id doesn't shadow) ===============
router.get("/drivers/ranking", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      driverId: driversTable.id,
      driverName: driversTable.name,
      deliveries: sql<number>`COUNT(${ordersTable.id})::int`,
      revenue: sql<number>`COALESCE(SUM(CASE WHEN ${ordersTable.status} = 'ENTREGADO' THEN ${ordersTable.amount} ELSE 0 END), 0)::float`,
    })
    .from(driversTable)
    .leftJoin(
      ordersTable,
      and(eq(ordersTable.driverId, driversTable.id), eq(ordersTable.status, "ENTREGADO")),
    )
    .groupBy(driversTable.id, driversTable.name)
    .orderBy(sql`COUNT(${ordersTable.id}) DESC`);

  const ranking = rows.map((r, idx) => ({
    driverId: r.driverId,
    driverName: r.driverName,
    deliveries: Number(r.deliveries),
    revenue: Number(r.revenue),
    rank: idx + 1,
  }));
  res.json(ranking);
});

// =============== ME (DRIVER) ===============
router.get("/me/driver", requireAuth, async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const [driver] = await db
    .select()
    .from(driversTable)
    .where(eq(driversTable.userId, req.user.sub));
  if (!driver) {
    res.status(404).json({ error: "No hay un repartidor vinculado a tu cuenta" });
    return;
  }
  res.json(serialize(driver));
});

router.patch(
  "/me/driver/status",
  requireAuth,
  requireRole("DRIVER", "SUPERUSER"),
  async (req, res): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    const parsed = UpdateMyDriverStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [driver] = await db
      .select()
      .from(driversTable)
      .where(eq(driversTable.userId, req.user.sub));
    if (!driver) {
      res.status(404).json({ error: "No hay un repartidor vinculado a tu cuenta" });
      return;
    }
    const [updated] = await db
      .update(driversTable)
      .set({ status: parsed.data.status })
      .where(eq(driversTable.id, driver.id))
      .returning();
    if (!updated) {
      res.status(500).json({ error: "No se pudo actualizar el estado" });
      return;
    }
    res.json(serialize(updated));
  },
);

// =============== ADMIN CRUD ===============
router.get(
  "/drivers",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res): Promise<void> => {
    const drivers = await db.select().from(driversTable).orderBy(driversTable.id);
    res.json(drivers.map(serialize));
  },
);

router.post(
  "/drivers",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res): Promise<void> => {
    const parsed = CreateDriverBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const driverCode = await nextDriverCode();
    const [driver] = await db
      .insert(driversTable)
      .values({
        driverCode,
        name: parsed.data.name,
        phone: parsed.data.phone,
        vehicle: parsed.data.vehicle,
        zones: parsed.data.zones,
        active: parsed.data.active ?? true,
        licensePlate: parsed.data.licensePlate ?? null,
        circulationCard: parsed.data.circulationCard ?? null,
        circulationCardExpiry: parsed.data.circulationCardExpiry
          ? String(parsed.data.circulationCardExpiry).slice(0, 10)
          : null,
      })
      .returning();
    if (!driver) {
      res.status(500).json({ error: "No se pudo crear el driver" });
      return;
    }
    res.status(201).json(serialize(driver));
  },
);

router.patch(
  "/drivers/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = UpdateDriverBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const updates: Record<string, unknown> = { ...parsed.data };
    if ("circulationCardExpiry" in updates && updates.circulationCardExpiry) {
      updates.circulationCardExpiry = String(updates.circulationCardExpiry).slice(0, 10);
    }
    const [driver] = await db
      .update(driversTable)
      .set(updates)
      .where(eq(driversTable.id, id))
      .returning();
    if (!driver) {
      res.status(404).json({ error: "Driver no encontrado" });
      return;
    }
    res.json(serialize(driver));
  },
);

router.delete(
  "/drivers/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [d] = await db
      .delete(driversTable)
      .where(eq(driversTable.id, id))
      .returning();
    if (!d) {
      res.status(404).json({ error: "Driver no encontrado" });
      return;
    }
    res.sendStatus(204);
  },
);

router.post(
  "/drivers/:id/cash-settle",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = SettleDriverCashBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [driver] = await db.select().from(driversTable).where(eq(driversTable.id, id));
    if (!driver) {
      res.status(404).json({ error: "Driver no encontrado" });
      return;
    }
    const current = Number(driver.cashPending);
    const newCash = Math.max(0, current - parsed.data.amount);
    const [updated] = await db
      .update(driversTable)
      .set({ cashPending: newCash.toFixed(2) })
      .where(eq(driversTable.id, id))
      .returning();
    if (!updated) {
      res.status(500).json({ error: "No se pudo liquidar" });
      return;
    }
    res.json(serialize(updated));
  },
);

export default router;
