import { Router, type IRouter } from "express";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import ExcelJS from "exceljs";
import {
  db,
  driversTable,
  ordersTable,
  benefitsConfigTable,
  benefitItemsTable,
  benefitClaimsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import type { Request } from "express";

const router: IRouter = Router();

function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  return { start, end };
}

function parsePeriod(req: { query: { year?: unknown; month?: unknown } }): {
  year: number;
  month: number;
} {
  const now = new Date();
  const yearRaw = Number(req.query.year);
  const monthRaw = Number(req.query.month);
  const year = Number.isFinite(yearRaw) && yearRaw >= 2020 && yearRaw <= 2100
    ? yearRaw
    : now.getUTCFullYear();
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12
    ? monthRaw
    : now.getUTCMonth() + 1;
  return { year, month };
}

async function buildTracking(year: number, month: number) {
  const { start, end } = monthRange(year, month);

  const [drivers, levels, items, deliveredOrders, claims] = await Promise.all([
    db
      .select({ id: driversTable.id, name: driversTable.name })
      .from(driversTable)
      .where(eq(driversTable.active, true))
      .orderBy(asc(driversTable.name)),
    db
      .select()
      .from(benefitsConfigTable)
      .orderBy(asc(benefitsConfigTable.level)),
    db.select().from(benefitItemsTable).orderBy(asc(benefitItemsTable.level)),
    db
      .select({
        driverId: ordersTable.driverId,
        updatedAt: ordersTable.updatedAt,
      })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.status, "ENTREGADO"),
          gte(ordersTable.updatedAt, start),
          lte(ordersTable.updatedAt, end),
        ),
      ),
    db
      .select()
      .from(benefitClaimsTable)
      .where(
        and(
          eq(benefitClaimsTable.year, year),
          eq(benefitClaimsTable.month, month),
        ),
      ),
  ]);

  const deliveriesByDriver = new Map<number, number>();
  for (const o of deliveredOrders) {
    if (o.driverId == null) continue;
    deliveriesByDriver.set(o.driverId, (deliveriesByDriver.get(o.driverId) ?? 0) + 1);
  }

  const claimKey = (driverId: number, benefitItemId: number) =>
    `${driverId}:${benefitItemId}`;
  const claimMap = new Map<string, { deliveredAt: Date }>();
  for (const c of claims) {
    claimMap.set(claimKey(c.driverId, c.benefitItemId), {
      deliveredAt: c.deliveredAt,
    });
  }

  const sortedLevels = [...levels].sort((a, b) => a.level - b.level);

  const rows = drivers.map((d) => {
    const deliveries = deliveriesByDriver.get(d.id) ?? 0;

    let currentLevel = 0;
    let currentLevelName: string | null = null;
    let nextLevel: number | null = null;
    let nextLevelName: string | null = null;
    let nextLevelTarget: number | null = null;
    let progressBase = 0;

    for (const lv of sortedLevels) {
      if (deliveries >= lv.deliveriesRequired) {
        currentLevel = lv.level;
        currentLevelName = lv.name;
        progressBase = lv.deliveriesRequired;
      } else {
        nextLevel = lv.level;
        nextLevelName = lv.name;
        nextLevelTarget = lv.deliveriesRequired;
        break;
      }
    }

    let progressPct: number;
    if (nextLevelTarget == null) {
      progressPct = sortedLevels.length === 0 ? 0 : 100;
    } else {
      const span = nextLevelTarget - progressBase;
      progressPct = span <= 0
        ? 100
        : Math.min(100, Math.max(0, ((deliveries - progressBase) / span) * 100));
    }

    const benefits = items
      .filter((it) => it.level <= currentLevel)
      .sort((a, b) => a.level - b.level || a.id - b.id)
      .map((it) => {
        const c = claimMap.get(claimKey(d.id, it.id));
        return {
          benefitItemId: it.id,
          level: it.level,
          name: it.name,
          icon: it.icon,
          status: c ? ("ENTREGADO" as const) : ("POR_RECLAMAR" as const),
          deliveredAt: c ? c.deliveredAt.toISOString() : null,
        };
      });

    return {
      driverId: d.id,
      driverName: d.name,
      deliveries,
      currentLevel,
      currentLevelName,
      nextLevel,
      nextLevelName,
      nextLevelTarget,
      progressPct: Math.round(progressPct * 10) / 10,
      benefits,
    };
  });

  return { year, month, rows };
}

// === Driver self-service ===

router.get(
  "/me/driver/benefits",
  requireAuth,
  requireRole("DRIVER", "SUPERUSER"),
  async (req: Request, res) => {
    const userId = (req as { user?: { sub?: number } }).user?.sub;
    if (!userId) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    const [driver] = await db
      .select({ id: driversTable.id, name: driversTable.name })
      .from(driversTable)
      .where(eq(driversTable.userId, userId));
    if (!driver) {
      res.status(404).json({
        error: "No hay un repartidor vinculado a tu cuenta",
      });
      return;
    }
    const { year, month } = parsePeriod(req);
    const tracking = await buildTracking(year, month);
    const row = tracking.rows.find((r) => r.driverId === driver.id);
    if (!row) {
      res.json({
        year,
        month,
        driverName: driver.name,
        deliveries: 0,
        currentLevel: 0,
        currentLevelName: null,
        nextLevel: null,
        nextLevelName: null,
        nextLevelTarget: null,
        remainingForNext: null,
        progressPct: 0,
        benefits: [],
      });
      return;
    }
    const remainingForNext =
      row.nextLevelTarget != null
        ? Math.max(0, row.nextLevelTarget - row.deliveries)
        : null;
    res.json({
      year,
      month,
      driverName: row.driverName,
      deliveries: row.deliveries,
      currentLevel: row.currentLevel,
      currentLevelName: row.currentLevelName,
      nextLevel: row.nextLevel,
      nextLevelName: row.nextLevelName,
      nextLevelTarget: row.nextLevelTarget,
      remainingForNext,
      progressPct: row.progressPct,
      benefits: row.benefits,
    });
  },
);

// === Benefit items CRUD ===

router.get(
  "/admin/benefit-items",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (_req, res) => {
    const items = await db
      .select()
      .from(benefitItemsTable)
      .orderBy(asc(benefitItemsTable.level), asc(benefitItemsTable.id));
    res.json(items);
  },
);

router.post(
  "/admin/benefit-items",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res) => {
    const body = req.body ?? {};
    const level = Number(body.level);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const icon = typeof body.icon === "string" ? body.icon.trim() : "gift";
    const description =
      typeof body.description === "string" ? body.description : null;
    if (!Number.isFinite(level) || level < 1 || !name) {
      res.status(400).json({ error: "Datos inválidos" });
      return;
    }
    const [created] = await db
      .insert(benefitItemsTable)
      .values({ level, name, icon, description })
      .returning();
    res.status(201).json(created);
  },
);

router.delete(
  "/admin/benefit-items/:id",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "id" });
      return;
    }
    await db.delete(benefitItemsTable).where(eq(benefitItemsTable.id, id));
    res.status(204).end();
  },
);

// === Tracking dashboard ===

router.get(
  "/admin/benefits-tracking",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res) => {
    const { year, month } = parsePeriod(req);
    const data = await buildTracking(year, month);
    res.json(data);
  },
);

router.post(
  "/admin/benefits-tracking/claim",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res) => {
    const { driverId, benefitItemId, year, month, delivered } = req.body ?? {};
    const dId = Number(driverId);
    const bId = Number(benefitItemId);
    const y = Number(year);
    const m = Number(month);
    if (
      !Number.isFinite(dId) ||
      !Number.isFinite(bId) ||
      !Number.isFinite(y) ||
      !Number.isFinite(m) ||
      m < 1 ||
      m > 12
    ) {
      res.status(400).json({ error: "Datos inválidos" });
      return;
    }
    const userId = (req as { user?: { id?: number } }).user?.id ?? null;

    if (delivered) {
      // Validar que el beneficio realmente esté desbloqueado para ese driver
      // en el período pedido antes de persistir el canje.
      const tracking = await buildTracking(y, m);
      const driverRow = tracking.rows.find((r) => r.driverId === dId);
      if (!driverRow) {
        res.status(404).json({ error: "Repartidor no encontrado" });
        return;
      }
      const benefit = driverRow.benefits.find((b) => b.benefitItemId === bId);
      if (!benefit) {
        res.status(409).json({
          error: "El beneficio aún no está desbloqueado para este período",
        });
        return;
      }
      // Upsert idempotente: si ya existe (por concurrencia), no falla.
      await db
        .insert(benefitClaimsTable)
        .values({
          driverId: dId,
          benefitItemId: bId,
          year: y,
          month: m,
          deliveredByUserId: userId ?? undefined,
        })
        .onConflictDoNothing({
          target: [
            benefitClaimsTable.driverId,
            benefitClaimsTable.benefitItemId,
            benefitClaimsTable.year,
            benefitClaimsTable.month,
          ],
        });
    } else {
      await db
        .delete(benefitClaimsTable)
        .where(
          and(
            eq(benefitClaimsTable.driverId, dId),
            eq(benefitClaimsTable.benefitItemId, bId),
            eq(benefitClaimsTable.year, y),
            eq(benefitClaimsTable.month, m),
          ),
        );
    }
    res.json({ ok: true });
  },
);

router.get(
  "/admin/benefits-tracking/export",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res) => {
    const { year, month } = parsePeriod(req);
    const data = await buildTracking(year, month);

    const wb = new ExcelJS.Workbook();
    wb.creator = "TiempoLibre";
    wb.created = new Date();

    const ws = wb.addWorksheet(`Ganadores ${month}-${year}`);
    ws.columns = [
      { header: "Repartidor", key: "driver", width: 28 },
      { header: "Entregas", key: "deliveries", width: 12 },
      { header: "Nivel alcanzado", key: "level", width: 22 },
      { header: "Beneficio", key: "benefit", width: 28 },
      { header: "Estatus", key: "status", width: 16 },
      { header: "Entregado el", key: "deliveredAt", width: 20 },
    ];
    ws.getRow(1).font = { bold: true };

    const winners = data.rows.filter((r) => r.benefits.length > 0);
    for (const r of winners) {
      for (const b of r.benefits) {
        ws.addRow({
          driver: r.driverName,
          deliveries: r.deliveries,
          level: `${b.level} - ${r.currentLevelName ?? ""}`.trim(),
          benefit: b.name,
          status: b.status === "ENTREGADO" ? "Entregado" : "Por reclamar",
          deliveredAt: b.deliveredAt
            ? new Date(b.deliveredAt).toLocaleString("es-MX")
            : "",
        });
      }
    }

    if (winners.length === 0) {
      ws.addRow({ driver: "Sin repartidores con beneficios este mes" });
    }

    const filename = `tiempolibre_beneficios_${year}_${String(month).padStart(2, "0")}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  },
);

export default router;
