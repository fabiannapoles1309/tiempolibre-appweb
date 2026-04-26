import { Router, type IRouter } from "express";
import { eq, sql, and, gte } from "drizzle-orm";
import {
  db,
  driversTable,
  ordersTable,
  subscriptionsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get(
  "/finance/cash-report",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res): Promise<void> => {
    const drivers = await db.select().from(driversTable);
    const collectedRow = await db
      .select({
        total: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)::float`,
      })
      .from(ordersTable)
      .where(and(eq(ordersTable.payment, "EFECTIVO"), eq(ordersTable.status, "ENTREGADO")));

    const totalCashCollected = Number(collectedRow[0]?.total ?? 0);
    const totalCashPending = drivers.reduce(
      (acc, d) => acc + Number(d.cashPending ?? 0),
      0,
    );

    res.json({
      totalCashPending,
      totalCashCollected,
      drivers: drivers
        .filter((d) => Number(d.cashPending) > 0)
        .map((d) => ({
          driverId: d.id,
          driverName: d.name,
          cashPending: Number(d.cashPending),
        })),
    });
  },
);

router.get(
  "/finance/b2b-revenue",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res): Promise<void> => {
    const startMonth = new Date();
    startMonth.setDate(1);
    startMonth.setHours(0, 0, 0, 0);

    const subs = await db
      .select({
        sub: subscriptionsTable,
        userName: usersTable.name,
      })
      .from(subscriptionsTable)
      .leftJoin(usersTable, eq(usersTable.id, subscriptionsTable.userId))
      .where(eq(subscriptionsTable.status, "ACTIVA"));

    const totalMrr = subs.reduce((acc, r) => acc + Number(r.sub.monthlyPrice), 0);

    // ingresos del mes desde pedidos entregados de clientes con suscripción
    const monthRevenueByCustomer = await db
      .select({
        customerId: ordersTable.customerId,
        revenue: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)::float`,
        ordersCount: sql<number>`COUNT(*)::int`,
      })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.status, "ENTREGADO"),
          gte(ordersTable.createdAt, startMonth),
        ),
      )
      .groupBy(ordersTable.customerId);

    const revenueMap = new Map<number, { revenue: number; ordersCount: number }>();
    for (const r of monthRevenueByCustomer) {
      revenueMap.set(r.customerId, {
        revenue: Number(r.revenue),
        ordersCount: Number(r.ordersCount),
      });
    }

    const totalRevenue = subs.reduce((acc, r) => {
      return acc + (revenueMap.get(r.sub.userId)?.revenue ?? 0);
    }, 0);

    const clients = subs.map((r) => {
      const stats = revenueMap.get(r.sub.userId) ?? { revenue: 0, ordersCount: 0 };
      return {
        customerId: r.sub.userId,
        customerName: r.userName ?? "Cliente",
        ordersCount: stats.ordersCount,
        revenue: stats.revenue,
        subscriptionTier: r.sub.tier,
      };
    });

    res.json({ totalRevenue, totalMrr, clients });
  },
);

export default router;
