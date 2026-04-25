import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, driversTable } from "@workspace/db";
import { CreateDriverBody, UpdateDriverBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function serialize(d: typeof driversTable.$inferSelect) {
  return {
    id: d.id,
    userId: d.userId,
    name: d.name,
    phone: d.phone,
    vehicle: d.vehicle,
    zones: d.zones,
    active: d.active,
    createdAt: d.createdAt.toISOString(),
  };
}

router.get("/drivers", requireAuth, async (_req, res): Promise<void> => {
  const drivers = await db.select().from(driversTable).orderBy(driversTable.id);
  res.json(drivers.map(serialize));
});

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
    const [driver] = await db
      .insert(driversTable)
      .values({
        name: parsed.data.name,
        phone: parsed.data.phone,
        vehicle: parsed.data.vehicle,
        zones: parsed.data.zones,
        active: parsed.data.active ?? true,
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
    const [driver] = await db
      .update(driversTable)
      .set(parsed.data)
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

export default router;
