import { Router, type IRouter } from "express";
import { eq, sql, inArray, and, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  driversTable,
  subscriptionsTable,
  ordersTable,
  benefitsConfigTable,
  walletsTable,
} from "@workspace/db";
import { hashPassword } from "../lib/auth";
import {
  AdminCreateUserBody,
  PutBenefitsConfigBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const TIERS = {
  ESTANDAR: { monthlyPrice: 15000, monthlyDeliveries: 35 },
  OPTIMO: { monthlyPrice: 25000, monthlyDeliveries: 70 },
} as const;

// =============== USERS ===============
router.post(
  "/admin/users",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const parsed = AdminCreateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { role, name, email, password, tier, phone, vehicle, zones, licensePlate, circulationCard } =
      parsed.data;

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) {
      res.status(409).json({ error: "Ya existe un usuario con ese email" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(usersTable)
      .values({ email, name, passwordHash, role })
      .returning();
    if (!created) {
      res.status(500).json({ error: "No se pudo crear el usuario" });
      return;
    }

    if (role === "CLIENTE") {
      await db
        .insert(walletsTable)
        .values({ userId: created.id, balance: "0.00" })
        .onConflictDoNothing();
      if (tier) {
        const cfg = TIERS[tier as keyof typeof TIERS];
        if (cfg) {
          await db.insert(subscriptionsTable).values({
            userId: created.id,
            tier,
            monthlyPrice: cfg.monthlyPrice.toFixed(2),
            monthlyDeliveries: cfg.monthlyDeliveries,
            usedDeliveries: 0,
            status: "ACTIVA",
          });
        }
      }
    }

    if (role === "DRIVER") {
      await db.insert(driversTable).values({
        userId: created.id,
        name,
        phone: phone ?? "",
        vehicle: vehicle ?? "",
        zones: zones ?? [],
        active: true,
        licensePlate: licensePlate ?? null,
        circulationCard: circulationCard ?? null,
        status: "ACTIVO",
      });
    }

    res.status(201).json({
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      createdAt: created.createdAt.toISOString(),
    });
  },
);

// =============== CUSTOMER DELIVERIES ===============
router.get(
  "/admin/customer-deliveries",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (_req, res): Promise<void> => {
    const customers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "CLIENTE"));

    const ids = customers.map((c) => c.id);
    const subs = ids.length
      ? await db
          .select()
          .from(subscriptionsTable)
          .where(inArray(subscriptionsTable.userId, ids))
          .orderBy(desc(subscriptionsTable.createdAt))
      : [];

    const subByUser = new Map<number, typeof subs[number]>();
    for (const s of subs) {
      // Keep most recent ACTIVA first; otherwise most recent any.
      const existing = subByUser.get(s.userId);
      if (!existing) {
        subByUser.set(s.userId, s);
      } else if (existing.status !== "ACTIVA" && s.status === "ACTIVA") {
        subByUser.set(s.userId, s);
      }
    }

    const rows = customers.map((c) => {
      const s = subByUser.get(c.id);
      const used = s?.usedDeliveries ?? 0;
      const monthly = s?.monthlyDeliveries ?? 0;
      return {
        customerId: c.id,
        customerName: c.name,
        tier: s?.tier ?? null,
        usedDeliveries: used,
        monthlyDeliveries: monthly,
        remainingDeliveries: Math.max(0, monthly - used),
        status: s?.status ?? null,
      };
    });

    res.json(rows);
  },
);

// =============== CASH BY CUSTOMER ===============
// Para cada cliente: cuánto efectivo tienen los drivers pendiente de pedidos pagados EFECTIVO + ENTREGADOS
// y aún no liquidados. Aproximación: sumamos amount de pedidos ENTREGADOS con payment EFECTIVO
// agrupados por cliente, restando los montos ya liquidados (no los rastreamos por pedido individual,
// usamos el cashPending del driver como proxy global pero esta vista lo muestra por cliente bruto).
router.get(
  "/admin/cash-by-customer",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (_req, res): Promise<void> => {
    // Sumamos el monto realmente cobrado en efectivo (cashAmount), con fallback
    // a orders.amount cuando cashAmount no esté seteado (pedidos viejos).
    const rows = await db
      .select({
        customerId: ordersTable.customerId,
        customerName: usersTable.name,
        ordersCount: sql<number>`COUNT(*)::int`,
        cashPending: sql<number>`COALESCE(SUM(COALESCE(${ordersTable.cashAmount}, ${ordersTable.amount})), 0)::float`,
      })
      .from(ordersTable)
      .leftJoin(usersTable, eq(usersTable.id, ordersTable.customerId))
      .where(
        and(
          eq(ordersTable.payment, "EFECTIVO"),
          eq(ordersTable.status, "ENTREGADO"),
        ),
      )
      .groupBy(ordersTable.customerId, usersTable.name);

    res.json(
      rows.map((r) => ({
        customerId: r.customerId,
        customerName: r.customerName ?? "Cliente",
        ordersCount: Number(r.ordersCount),
        cashPending: Number(r.cashPending),
      })),
    );
  },
);

// =============== BENEFITS CONFIG ===============
router.get(
  "/admin/benefits-config",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER", "DRIVER"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(benefitsConfigTable).orderBy(benefitsConfigTable.level);
    res.json(rows);
  },
);

router.put(
  "/admin/benefits-config",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const parsed = PutBenefitsConfigBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const updated = await db.transaction(async (tx) => {
      await tx.delete(benefitsConfigTable);
      if (parsed.data.levels.length > 0) {
        await tx.insert(benefitsConfigTable).values(parsed.data.levels);
      }
      return tx.select().from(benefitsConfigTable).orderBy(benefitsConfigTable.level);
    });
    res.json(updated);
  },
);

// =============== FINANCE TODAY SPLIT ===============
router.get(
  "/finance/today-split",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (_req, res): Promise<void> => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const repartoRow = await db
      .select({
        total: sql<number>`COALESCE(SUM(${ordersTable.amount}), 0)::float`,
      })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.status, "ENTREGADO"),
          sql`${ordersTable.createdAt} >= ${start}`,
          sql`${ordersTable.createdAt} <= ${end}`,
        ),
      );

    const planesRow = await db
      .select({
        total: sql<number>`COALESCE(SUM(${subscriptionsTable.monthlyPrice}), 0)::float`,
      })
      .from(subscriptionsTable)
      .where(
        and(
          sql`${subscriptionsTable.createdAt} >= ${start}`,
          sql`${subscriptionsTable.createdAt} <= ${end}`,
        ),
      );

    const reparto = Number(repartoRow[0]?.total ?? 0);
    const planes = Number(planesRow[0]?.total ?? 0);
    res.json({
      repartoToday: reparto,
      planesToday: planes,
      total: reparto + planes,
    });
  },
);

export default router;
