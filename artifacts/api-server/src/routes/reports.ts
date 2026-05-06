import { Router, type IRouter } from "express";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, ordersTable, driversTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function getRangeStart(range: string): Date {
  const now = new Date();
  const start = new Date(now);
  switch (range) {
    case "day":
      start.setHours(0, 0, 0, 0);
      break;
    case "week":
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start.setHours(0, 0, 0, 0);
  }
  return start;
}

router.get(
  "/deliveries",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res): Promise<void> => {
    const range = typeof req.query.range === "string" ? req.query.range : "day";
    const zone = typeof req.query.zone === "string" ? req.query.zone : null;
    const start = getRangeStart(range);

    const filters = [
      gte(ordersTable.createdAt, start),
      eq(ordersTable.status, "ENTREGADO"),
    ];
    if (zone) filters.push(eq(ordersTable.zone, zone));

    const rows = await db
      .select()
      .from(ordersTable)
      .where(and(...filters));

    const dayMap = new Map<string, { count: number; revenue: number }>();
    for (const o of rows) {
      const d = new Date(o.createdAt);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const cur = dayMap.get(key) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(o.amount);
      dayMap.set(key, cur);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const result: { date: string; count: number; revenue: number }[] = [];
    for (let d = new Date(start); d <= today; d = new Date(d.getTime() + dayMs)) {
      const key = d.toISOString().slice(0, 10);
      const entry = dayMap.get(key) ?? { count: 0, revenue: 0 };
      result.push({ date: key, ...entry });
    }
    res.json(result);
  },
);

router.get(
  "/drivers",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res): Promise<void> => {
    const range = typeof req.query.range === "string" ? req.query.range : "month";
    const start = getRangeStart(range);

    const rows = await db
      .select({
        driverId: ordersTable.driverId,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${ordersTable.amount}), 0)::float`,
      })
      .from(ordersTable)
      .where(
        and(
          gte(ordersTable.createdAt, start),
          eq(ordersTable.status, "ENTREGADO"),
        ),
      )
      .groupBy(ordersTable.driverId);

    const drivers = await db.select().from(driversTable);

    const result = drivers.map((d) => {
      const stat = rows.find((r) => r.driverId === d.id);
      return {
        driverId: d.id,
        driverName: d.name,
        zones: d.zones,
        deliveries: stat?.count ?? 0,
        revenue: stat?.revenue ?? 0,
        active: d.active,
      };
    });
    result.sort((a, b) => b.deliveries - a.deliveries);
    res.json(result);
  },
);

router.get(
  "/dashboard",
  requireAuth,
  async (req, res): Promise<void> => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let allOrders = await db.select().from(ordersTable);
    if (req.user!.role === "CLIENTE") {
      allOrders = allOrders.filter((o) => o.customerId === req.user!.sub);
    } else if (req.user!.role === "DRIVER") {
      const [driver] = await db
        .select()
        .from(driversTable)
        .where(eq(driversTable.userId, req.user!.sub));
      allOrders = driver ? allOrders.filter((o) => o.driverId === driver.id) : [];
    }

    const todayOrders = allOrders.filter((o) => o.createdAt >= startOfDay);
    const pending = allOrders.filter((o) => o.status === "PENDIENTE");
    const inRoute = allOrders.filter((o) => o.status === "EN_RUTA");
    const deliveredToday = todayOrders.filter((o) => o.status === "ENTREGADO");
    const todayRevenue = deliveredToday.reduce((acc, o) => acc + Number(o.amount), 0);
    const todayDeliveryExpense = todayOrders
      .filter((o) => o.status !== "CANCELADO")
      .reduce((acc, o) => acc + Number(o.amount), 0);
    const drivers = await db.select().from(driversTable);
    const activeDrivers = drivers.filter((d) => d.active).length;

    const ordersByStatus = ["PENDIENTE", "ASIGNADO", "EN_RUTA", "ENTREGADO", "CANCELADO"].map(
      (status) => ({
        status,
        count: allOrders.filter((o) => o.status === status).length,
      }),
    );

    const zones = ["1", "2", "3", "4", "5", "6", "7", "8"];
    const ordersByZone = zones.map((zone) => {
      const zoneOrders = allOrders.filter((o) => o.zone === zone);
      return {
        zone,
        count: zoneOrders.length,
        revenue: zoneOrders.reduce((a, o) => a + Number(o.amount), 0),
      };
    });

    const recentRows = allOrders
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8);
    const customerIds = Array.from(new Set(recentRows.map((r) => r.customerId)));
    const driverIds = Array.from(
      new Set(recentRows.map((r) => r.driverId).filter((v): v is number => v != null)),
    );
    const { usersTable } = await import("@workspace/db");
    const customers = customerIds.length
      ? await db.select().from(usersTable).where(inArray(usersTable.id, customerIds))
      : [];
    const driverList = driverIds.length
      ? await db.select().from(driversTable).where(inArray(driversTable.id, driverIds))
      : [];
    const customerMap = new Map(customers.map((c) => [c.id, c.name]));
    const driverNameMap = new Map(driverList.map((d) => [d.id, d.name]));

    const recentOrders = recentRows.map((o) => ({
      id: o.id,
      customerId: o.customerId,
      customerName: customerMap.get(o.customerId) ?? "Cliente",
      pickup: o.pickup,
      delivery: o.delivery,
      zone: o.zone,
      payment: o.payment,
      amount: Number(o.amount),
      status: o.status,
      driverId: o.driverId,
      driverName: o.driverId != null ? driverNameMap.get(o.driverId) ?? null : null,
      notes: o.notes,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    }));

    res.json({
      kpis: {
        todayOrders: todayOrders.length,
        pendingOrders: pending.length,
        inRouteOrders: inRoute.length,
        deliveredToday: deliveredToday.length,
        todayRevenue,
        todayDeliveryExpense,
        activeDrivers,
      },
      ordersByStatus,
      ordersByZone,
      recentOrders,
    });
  },
);

export default router;

