import { Router, type IRouter } from "express";
import { eq, sql, inArray, and, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  driversTable,
  customersTable,
  subscriptionsTable,
  ordersTable,
  benefitsConfigTable,
  walletsTable,
} from "@workspace/db";
import { hashPassword } from "../lib/auth";
import {
  AdminCreateUserBody,
  AdminUpdateClienteBody,
  PutBenefitsConfigBody,
} from "@workspace/api-zod";
import {
  buildDriverWelcomeMessage,
  resolveAppUrl,
} from "../services/notificationService";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const TIERS = {
  ESTANDAR: { monthlyPrice: 15000, monthlyDeliveries: 35 },
  OPTIMO: { monthlyPrice: 25000, monthlyDeliveries: 70 },
} as const;

const RECHARGE_BLOCK = 35;

type ClienteRowShape = {
  id: number;
  name: string;
  email: string;
  businessName: string | null;
  pickupAddress: string | null;
  clienteZone: number | null;
  phone: string | null;
  tier: "ESTANDAR" | "OPTIMO" | null;
  status: string | null;
  usedDeliveries: number;
  monthlyDeliveries: number;
  remainingDeliveries: number;
  createdAt: string;
};

async function buildClienteRow(userId: number): Promise<ClienteRowShape | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "CLIENTE") return null;
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.userId, userId));
  // Pick most relevant subscription (ACTIVA most-recent first, otherwise most recent of any).
  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionsTable.createdAt));
  const sub = subs.find((s) => s.status === "ACTIVA") ?? subs[0] ?? null;
  const used = sub?.usedDeliveries ?? 0;
  const monthly = sub?.monthlyDeliveries ?? 0;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    businessName: customer?.businessName ?? null,
    pickupAddress: customer?.pickupAddress ?? null,
    clienteZone: customer?.zone ?? null,
    phone: customer?.phone ?? null,
    tier: (sub?.tier as "ESTANDAR" | "OPTIMO" | undefined) ?? null,
    status: sub?.status ?? null,
    usedDeliveries: used,
    monthlyDeliveries: monthly,
    remainingDeliveries: Math.max(0, monthly - used),
    createdAt: user.createdAt.toISOString(),
  };
}

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
    const {
      role,
      name,
      email,
      password,
      tier,
      phone,
      vehicle,
      zones,
      licensePlate,
      circulationCard,
      businessName,
      pickupAddress,
      clienteZone,
    } = parsed.data;

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
      // Perfil del cliente (vinculado al user). El nombre del establecimiento
      // se mantiene atado a su dirección de recolección; ambos opcionales en alta
      // pero se persisten cuando vienen.
      await db
        .insert(customersTable)
        .values({
          userId: created.id,
          businessName: businessName ?? null,
          pickupAddress: pickupAddress ?? null,
          zone: clienteZone ?? null,
          phone: phone ?? null,
        })
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

    // Para drivers generamos el mensaje de bienvenida listo para enviar por SMS.
    // El admin lo verá en un modal con botón "copiar al portapapeles".
    const welcomeMessage =
      role === "DRIVER"
        ? buildDriverWelcomeMessage({
            name,
            email,
            password,
            appUrl: resolveAppUrl(),
          })
        : null;

    res.status(201).json({
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      createdAt: created.createdAt.toISOString(),
      welcomeMessage,
    });
  },
);

// =============== CLIENTES (gestión avanzada) ===============
// Lista todos los CLIENTE con su perfil (customers) + suscripción activa resumida.
router.get(
  "/admin/clientes",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (_req, res): Promise<void> => {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "CLIENTE"));
    const ids = users.map((u) => u.id);
    const customers = ids.length
      ? await db.select().from(customersTable).where(inArray(customersTable.userId, ids))
      : [];
    const subs = ids.length
      ? await db
          .select()
          .from(subscriptionsTable)
          .where(inArray(subscriptionsTable.userId, ids))
          .orderBy(desc(subscriptionsTable.createdAt))
      : [];
    const customerByUser = new Map(customers.map((c) => [c.userId, c]));
    const subByUser = new Map<number, typeof subs[number]>();
    for (const s of subs) {
      const existing = subByUser.get(s.userId);
      if (!existing) subByUser.set(s.userId, s);
      else if (existing.status !== "ACTIVA" && s.status === "ACTIVA") subByUser.set(s.userId, s);
    }
    const rows: ClienteRowShape[] = users.map((u) => {
      const c = customerByUser.get(u.id);
      const s = subByUser.get(u.id);
      const used = s?.usedDeliveries ?? 0;
      const monthly = s?.monthlyDeliveries ?? 0;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        businessName: c?.businessName ?? null,
        pickupAddress: c?.pickupAddress ?? null,
        clienteZone: c?.zone ?? null,
        phone: c?.phone ?? null,
        tier: (s?.tier as "ESTANDAR" | "OPTIMO" | undefined) ?? null,
        status: s?.status ?? null,
        usedDeliveries: used,
        monthlyDeliveries: monthly,
        remainingDeliveries: Math.max(0, monthly - used),
        createdAt: u.createdAt.toISOString(),
      };
    });
    res.json(rows);
  },
);

router.patch(
  "/admin/clientes/:id",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = AdminUpdateClienteBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const data = parsed.data;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user || user.role !== "CLIENTE") {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    if (data.name) {
      await db.update(usersTable).set({ name: data.name }).where(eq(usersTable.id, id));
    }
    // Asegura una fila customers (compat con clientes creados antes del feature).
    await db
      .insert(customersTable)
      .values({ userId: id })
      .onConflictDoNothing();
    const customerPatch: Record<string, unknown> = {};
    if (data.businessName !== undefined) customerPatch.businessName = data.businessName;
    if (data.pickupAddress !== undefined) customerPatch.pickupAddress = data.pickupAddress;
    if (data.clienteZone !== undefined) customerPatch.zone = data.clienteZone;
    if (data.phone !== undefined) customerPatch.phone = data.phone;
    if (Object.keys(customerPatch).length > 0) {
      await db.update(customersTable).set(customerPatch).where(eq(customersTable.userId, id));
    }
    if (data.tier) {
      const cfg = TIERS[data.tier as keyof typeof TIERS];
      if (cfg) {
        // Cancelar otra ACTIVA y crear la nueva del tier solicitado.
        await db
          .update(subscriptionsTable)
          .set({ status: "CANCELADA" })
          .where(
            and(eq(subscriptionsTable.userId, id), eq(subscriptionsTable.status, "ACTIVA")),
          );
        await db.insert(subscriptionsTable).values({
          userId: id,
          tier: data.tier,
          monthlyPrice: cfg.monthlyPrice.toFixed(2),
          monthlyDeliveries: cfg.monthlyDeliveries,
          usedDeliveries: 0,
          status: "ACTIVA",
        });
      }
    }
    const row = await buildClienteRow(id);
    res.json(row);
  },
);

router.post(
  "/admin/clientes/:id/recharge",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target || target.role !== "CLIENTE") {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    const [latest] = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.userId, id),
          inArray(subscriptionsTable.status, ["ACTIVA", "VENCIDA"]),
        ),
      )
      .orderBy(desc(subscriptionsTable.createdAt));
    if (!latest) {
      res.status(404).json({ error: "El cliente no tiene una suscripción para recargar" });
      return;
    }
    await db
      .update(subscriptionsTable)
      .set({
        monthlyDeliveries: latest.monthlyDeliveries + RECHARGE_BLOCK,
        status: "ACTIVA",
      })
      .where(eq(subscriptionsTable.id, latest.id));
    const row = await buildClienteRow(id);
    res.json(row);
  },
);

router.post(
  "/admin/clientes/:id/renew",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target || target.role !== "CLIENTE") {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    const [latest] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, id))
      .orderBy(desc(subscriptionsTable.createdAt));
    if (!latest) {
      res.status(404).json({ error: "El cliente no tiene una suscripción para renovar" });
      return;
    }
    const cfg = TIERS[latest.tier as keyof typeof TIERS];
    if (!cfg) {
      res.status(400).json({ error: "Tier inválido en la suscripción actual" });
      return;
    }
    // Cancelar la actual y crear una nueva ACTIVA con bloque limpio.
    await db
      .update(subscriptionsTable)
      .set({ status: "CANCELADA" })
      .where(eq(subscriptionsTable.id, latest.id));
    await db.insert(subscriptionsTable).values({
      userId: id,
      tier: latest.tier,
      monthlyPrice: cfg.monthlyPrice.toFixed(2),
      monthlyDeliveries: cfg.monthlyDeliveries,
      usedDeliveries: 0,
      status: "ACTIVA",
    });
    const row = await buildClienteRow(id);
    res.json(row);
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
