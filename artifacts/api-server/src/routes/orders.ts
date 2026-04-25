import { Router, type IRouter } from "express";
import { and, eq, gte, lte, inArray, asc, desc, sql } from "drizzle-orm";
import {
  db,
  ordersTable,
  driversTable,
  usersTable,
  transactionsTable,
  walletsTable,
  walletTxTable,
  subscriptionsTable,
  type Order,
} from "@workspace/db";
import {
  CreateOrderBody,
  UpdateOrderBody,
  AssignOrderManualBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { serializeOrder } from "../lib/serializers";
import { validarZona } from "../lib/mapService";

const router: IRouter = Router();

async function expandOrders(orders: Order[]) {
  if (orders.length === 0) return [];
  const customerIds = Array.from(new Set(orders.map((o) => o.customerId)));
  const driverIds = Array.from(
    new Set(orders.map((o) => o.driverId).filter((v): v is number => v != null)),
  );

  const customers = customerIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, customerIds))
    : [];
  const drivers = driverIds.length
    ? await db.select().from(driversTable).where(inArray(driversTable.id, driverIds))
    : [];

  const customerMap = new Map(customers.map((c) => [c.id, c.name]));
  const driverMap = new Map(drivers.map((d) => [d.id, d.name]));

  return orders.map((o) =>
    serializeOrder(
      o,
      customerMap.get(o.customerId) ?? "Cliente",
      o.driverId != null ? driverMap.get(o.driverId) ?? null : null,
    ),
  );
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const filters = [];
  const { status, zone, customerId, driverId, from, to } = req.query;

  // RBAC scoping:
  // - CLIENTE: only orders they created
  // - DRIVER: only orders assigned to their driver record (resolved via userId)
  // - ADMIN: all orders, with optional filters
  if (req.user!.role === "CLIENTE") {
    filters.push(eq(ordersTable.customerId, req.user!.sub));
  } else if (req.user!.role === "DRIVER") {
    const [driver] = await db
      .select()
      .from(driversTable)
      .where(eq(driversTable.userId, req.user!.sub));
    if (!driver) {
      res.json([]);
      return;
    }
    filters.push(eq(ordersTable.driverId, driver.id));
  }

  if (typeof status === "string") filters.push(eq(ordersTable.status, status));
  // Only ADMIN may filter by zone or by other customers/drivers via query params
  if (req.user!.role === "ADMIN") {
    if (typeof zone === "string") filters.push(eq(ordersTable.zone, zone));
    if (typeof customerId === "string")
      filters.push(eq(ordersTable.customerId, parseInt(customerId, 10)));
    if (typeof driverId === "string")
      filters.push(eq(ordersTable.driverId, parseInt(driverId, 10)));
  }
  if (typeof from === "string") filters.push(gte(ordersTable.createdAt, new Date(from)));
  if (typeof to === "string") filters.push(lte(ordersTable.createdAt, new Date(to)));

  const rows = await db
    .select()
    .from(ordersTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(ordersTable.createdAt));

  res.json(await expandOrders(rows));
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const [row] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }
  if (req.user!.role === "CLIENTE" && row.customerId !== req.user!.sub) {
    res.status(403).json({ error: "No autorizado" });
    return;
  }
  if (req.user!.role === "DRIVER") {
    const [driver] = await db
      .select()
      .from(driversTable)
      .where(eq(driversTable.userId, req.user!.sub));
    if (!driver || row.driverId !== driver.id) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }
  }
  const [serialized] = await expandOrders([row]);
  res.json(serialized);
});

router.post(
  "/orders",
  requireAuth,
  requireRole("CLIENTE"),
  async (req, res): Promise<void> => {
    const parsed = CreateOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const amount = parsed.data.amount ?? 0;

    // Validación geográfica: la dirección de entrega debe caer dentro de algún polígono KML.
    const validation = await validarZona(parsed.data.delivery);
    if (!validation.ok) {
      const reason = validation.reason ?? "FUERA_DE_ZONA";
      const message =
        reason === "ZONAS_NO_CARGADAS"
          ? "El servicio de zonas no está disponible. Contactá a soporte."
          : reason === "DIRECCION_NO_GEOCODIFICADA"
          ? "No pudimos ubicar la dirección de entrega. Verificá que esté completa."
          : "Dirección fuera de zona de cobertura";
      res.status(400).json({ error: message, reason });
      return;
    }
    const computedZone = validation.zone;
    const deliveryLat = validation.point ? String(validation.point.lat) : null;
    const deliveryLng = validation.point ? String(validation.point.lng) : null;

    // Wallet payment: deduct balance now
    if (parsed.data.payment === "BILLETERA") {
      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, req.user!.sub));
      const balance = wallet ? Number(wallet.balance) : 0;
      if (balance < amount) {
        res.status(400).json({ error: "Saldo insuficiente en la billetera" });
        return;
      }
      await db
        .update(walletsTable)
        .set({ balance: String(balance - amount) })
        .where(eq(walletsTable.userId, req.user!.sub));
      await db.insert(walletTxTable).values({
        userId: req.user!.sub,
        amount: String(amount),
        type: "PAGO",
        description: "Pago de pedido",
      });
    }

    const [order] = await db
      .insert(ordersTable)
      .values({
        customerId: req.user!.sub,
        pickup: parsed.data.pickup,
        delivery: parsed.data.delivery,
        zone: computedZone,
        payment: parsed.data.payment,
        amount: String(amount),
        deliveryLat,
        deliveryLng,
        notes: parsed.data.notes ?? null,
        status: "PENDIENTE",
      })
      .returning();
    if (!order) {
      res.status(500).json({ error: "No se pudo crear el pedido" });
      return;
    }

    // Record income transaction
    await db.insert(transactionsTable).values({
      orderId: order.id,
      amount: String(amount),
      type: "INGRESO",
      method: parsed.data.payment,
      description: `Pedido #${order.id}`,
    });

    const [serialized] = await expandOrders([order]);
    res.status(201).json(serialized);
  },
);

router.patch(
  "/orders/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = UpdateOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (req.user!.role === "CLIENTE") {
      res.status(403).json({ error: "No autorizado" });
      return;
    }

    // DRIVER may only update orders assigned to them, and cannot reassign driverId
    if (req.user!.role === "DRIVER") {
      const [driver] = await db
        .select()
        .from(driversTable)
        .where(eq(driversTable.userId, req.user!.sub));
      const [existing] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id));
      if (!driver || !existing || existing.driverId !== driver.id) {
        res.status(403).json({ error: "No autorizado" });
        return;
      }
      if (parsed.data.driverId !== undefined) {
        res.status(403).json({ error: "No podés reasignar el pedido" });
        return;
      }
    }

    const updates: Partial<typeof ordersTable.$inferInsert> = {};
    if (parsed.data.status != null) {
      updates.status = parsed.data.status;
      if (parsed.data.status === "ASIGNADO" && parsed.data.driverId == null) {
        // status alone — keep driver as is
      }
    }
    if (parsed.data.driverId !== undefined) {
      updates.driverId = parsed.data.driverId;
      if (parsed.data.driverId != null && parsed.data.status == null) {
        updates.status = "ASIGNADO";
      }
    }

    // Transacción: actualizar pedido + side-effects (cash + suscripción) atómicamente
    const updated = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id));
      if (!previous) return null;
      const [u] = await tx
        .update(ordersTable)
        .set(updates)
        .where(eq(ordersTable.id, id))
        .returning();
      if (!u) return null;

      const becameDelivered =
        previous.status !== "ENTREGADO" && u.status === "ENTREGADO";

      if (becameDelivered) {
        if (u.driverId != null && u.payment === "EFECTIVO") {
          const [drv] = await tx
            .select()
            .from(driversTable)
            .where(eq(driversTable.id, u.driverId));
          if (drv) {
            const newCash = Number(drv.cashPending) + Number(u.amount);
            await tx
              .update(driversTable)
              .set({ cashPending: newCash.toFixed(2) })
              .where(eq(driversTable.id, drv.id));
          }
        }
        if (u.customerId != null) {
          const [activeSub] = await tx
            .select()
            .from(subscriptionsTable)
            .where(
              and(
                eq(subscriptionsTable.userId, u.customerId),
                eq(subscriptionsTable.status, "ACTIVA"),
              ),
            );
          if (activeSub) {
            const newUsed = activeSub.usedDeliveries + 1;
            const exhausted = newUsed >= activeSub.monthlyDeliveries;
            await tx
              .update(subscriptionsTable)
              .set({
                usedDeliveries: newUsed,
                status: exhausted ? "VENCIDA" : activeSub.status,
              })
              .where(eq(subscriptionsTable.id, activeSub.id));
          }
        }
      }
      return u;
    });

    if (!updated) {
      res.status(404).json({ error: "Pedido no encontrado" });
      return;
    }

    const [serialized] = await expandOrders([updated]);
    res.json(serialized);
  },
);

router.post(
  "/orders/assign-auto",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res): Promise<void> => {
    const pending = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.status, "PENDIENTE"))
      .orderBy(asc(ordersTable.createdAt));

    const drivers = await db
      .select()
      .from(driversTable)
      .where(eq(driversTable.active, true));

    // Compute current driver loads (active orders not delivered/cancelled)
    const loadRows = await db
      .select({
        driverId: ordersTable.driverId,
        count: sql<number>`count(*)::int`,
      })
      .from(ordersTable)
      .where(inArray(ordersTable.status, ["ASIGNADO", "EN_RUTA"]))
      .groupBy(ordersTable.driverId);

    const loadMap = new Map<number, number>();
    for (const row of loadRows) {
      if (row.driverId != null) loadMap.set(row.driverId, row.count);
    }

    const details: { orderId: number; driverId: number | null; zone: string | null; status: string }[] = [];
    let assigned = 0;
    let skipped = 0;

    for (const order of pending) {
      if (!order.zone) {
        details.push({ orderId: order.id, driverId: null, zone: null, status: "sin_zona" });
        skipped++;
        continue;
      }
      const orderZone = order.zone;
      const candidates = drivers.filter((d) => d.zones.includes(orderZone));
      if (candidates.length === 0) {
        details.push({ orderId: order.id, driverId: null, zone: orderZone, status: "sin_drivers" });
        skipped++;
        continue;
      }
      candidates.sort(
        (a, b) => (loadMap.get(a.id) ?? 0) - (loadMap.get(b.id) ?? 0),
      );
      const chosen = candidates[0]!;
      await db
        .update(ordersTable)
        .set({ driverId: chosen.id, status: "ASIGNADO" })
        .where(eq(ordersTable.id, order.id));
      loadMap.set(chosen.id, (loadMap.get(chosen.id) ?? 0) + 1);
      details.push({ orderId: order.id, driverId: chosen.id, zone: orderZone, status: "asignado" });
      assigned++;
    }

    res.json({ assigned, skipped, details });
  },
);

router.post(
  "/orders/:id/assign-manual",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = AssignOrderManualBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [driver] = await db
      .select()
      .from(driversTable)
      .where(eq(driversTable.id, parsed.data.driverId));
    if (!driver) {
      res.status(404).json({ error: "Driver no encontrado" });
      return;
    }
    const [updated] = await db
      .update(ordersTable)
      .set({ driverId: driver.id, status: "ASIGNADO" })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Pedido no encontrado" });
      return;
    }
    const [serialized] = await expandOrders([updated]);
    res.json(serialized);
  },
);

export default router;
