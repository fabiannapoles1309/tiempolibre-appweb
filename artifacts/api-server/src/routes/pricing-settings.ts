import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import {
  db,
  pricingSettingsTable,
  PRICING_KEYS,
  PRICING_DEFAULTS,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function parseBody(body: unknown):
  | { ok: true; data: { estandarPrice: number; optimoPrice: number; extraPackagePrice: number } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido" };
  }
  const b = body as Record<string, unknown>;
  const fields = ["estandarPrice", "optimoPrice", "extraPackagePrice"] as const;
  const out: Record<string, number> = {};
  // numeric(12,2) -> hasta 10 dígitos enteros + 2 decimales
  const MAX_VALUE = 9_999_999_999.99;
  for (const k of fields) {
    const n = Number(b[k]);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: `Valor inválido para ${k}` };
    }
    if (n > MAX_VALUE) {
      return { ok: false, error: `${k} excede el máximo permitido` };
    }
    // Forzar máximo 2 decimales (rechazar precisión extra)
    const rounded = Math.round(n * 100) / 100;
    if (Math.abs(rounded - n) > 1e-9) {
      return { ok: false, error: `${k} sólo admite hasta 2 decimales` };
    }
    out[k] = rounded;
  }
  return {
    ok: true,
    data: out as { estandarPrice: number; optimoPrice: number; extraPackagePrice: number },
  };
}

/**
 * Carga los 3 precios configurables desde la tabla `pricing_settings`.
 * Si por algún motivo falta un row, devuelve el default seguro para
 * evitar romper checkout/aprobación. Las altas iniciales se hacen con
 * el seed SQL al crear la tabla.
 */
export async function getPricing(): Promise<{
  estandarPrice: number;
  optimoPrice: number;
  extraPackagePrice: number;
}> {
  const rows = await db.select().from(pricingSettingsTable);
  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
  return {
    estandarPrice:
      map.get(PRICING_KEYS.ESTANDAR_PRICE) ?? PRICING_DEFAULTS.ESTANDAR_PRICE,
    optimoPrice:
      map.get(PRICING_KEYS.OPTIMO_PRICE) ?? PRICING_DEFAULTS.OPTIMO_PRICE,
    extraPackagePrice:
      map.get(PRICING_KEYS.EXTRA_PACKAGE_PRICE) ??
      PRICING_DEFAULTS.EXTRA_PACKAGE_PRICE,
  };
}

router.get("/pricing-settings", requireAuth, async (_req, res): Promise<void> => {
  const pricing = await getPricing();
  res.json(pricing);
});

router.put(
  "/admin/pricing-settings",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const parsed = parseBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const updates: Array<[string, number]> = [
      [PRICING_KEYS.ESTANDAR_PRICE, parsed.data.estandarPrice],
      [PRICING_KEYS.OPTIMO_PRICE, parsed.data.optimoPrice],
      [PRICING_KEYS.EXTRA_PACKAGE_PRICE, parsed.data.extraPackagePrice],
    ];
    // Upsert por clave para que también funcione si por alguna razón
    // falta el row (por ejemplo, en una base recién migrada).
    await db.transaction(async (tx) => {
      for (const [key, value] of updates) {
        await tx
          .insert(pricingSettingsTable)
          .values({ key, value: value.toFixed(2) })
          .onConflictDoUpdate({
            target: pricingSettingsTable.key,
            set: { value: value.toFixed(2), updatedAt: sql`now()` },
          });
      }
    });
    const pricing = await getPricing();
    res.json(pricing);
  },
);

export default router;
