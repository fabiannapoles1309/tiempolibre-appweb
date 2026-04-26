import { Router, type IRouter } from "express";
import { and, gte, sql, desc, eq, inArray } from "drizzle-orm";
import { db, transactionsTable, ordersTable } from "@workspace/db";
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
  "/finance/summary",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res): Promise<void> => {
    const range = typeof req.query.range === "string" ? req.query.range : "day";
    const start = getRangeStart(range);

    const txs = await db
      .select()
      .from(transactionsTable)
      .where(gte(transactionsTable.createdAt, start));

    let income = 0;
    let expenses = 0;
    const byMethodMap = new Map<string, { total: number; count: number }>();
    for (const t of txs) {
      const amt = Number(t.amount);
      if (t.type === "INGRESO") income += amt;
      else expenses += amt;
      const cur = byMethodMap.get(t.method) ?? { total: 0, count: 0 };
      cur.total += t.type === "INGRESO" ? amt : -amt;
      cur.count += 1;
      byMethodMap.set(t.method, cur);
    }

    // Orders count in range
    const orderCountRow = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ordersTable)
      .where(gte(ordersTable.createdAt, start));
    const ordersCount = orderCountRow[0]?.count ?? 0;

    // Build timeline by day from start..today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    const timeline: { date: string; income: number; expenses: number }[] = [];
    const dayMap = new Map<string, { income: number; expenses: number }>();
    for (const t of txs) {
      const d = new Date(t.createdAt);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const entry = dayMap.get(key) ?? { income: 0, expenses: 0 };
      const amt = Number(t.amount);
      if (t.type === "INGRESO") entry.income += amt;
      else entry.expenses += amt;
      dayMap.set(key, entry);
    }
    for (let d = new Date(start); d <= today; d = new Date(d.getTime() + dayMs)) {
      const key = d.toISOString().slice(0, 10);
      const entry = dayMap.get(key) ?? { income: 0, expenses: 0 };
      timeline.push({ date: key, ...entry });
    }

    res.json({
      range,
      income,
      expenses,
      profit: income - expenses,
      ordersCount,
      avgTicket: ordersCount > 0 ? income / ordersCount : 0,
      byMethod: Array.from(byMethodMap.entries()).map(([method, v]) => ({
        method,
        total: v.total,
        count: v.count,
      })),
      timeline,
    });
  },
);

router.get(
  "/finance/transactions",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res): Promise<void> => {
    const txs = await db
      .select()
      .from(transactionsTable)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(200);
    res.json(
      txs.map((t) => ({
        id: t.id,
        orderId: t.orderId,
        amount: Number(t.amount),
        type: t.type,
        method: t.method,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    );
  },
);

export default router;
