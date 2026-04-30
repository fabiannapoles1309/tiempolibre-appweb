import { Router } from "express";
import { db } from "../db";

export const driverStatusRouter = Router();

// GET /api/driver/status
driverStatusRouter.get("/status", async (req: any, res) => {
  try {
    const driverId = req.user?.id;
    const driver = await db.query.drivers.findFirst({
      where: (d, { eq }) => eq(d.userId, driverId),
    });
    res.json({ active: driver?.isActive ?? true });
  } catch (e) {
    res.status(500).json({ error: "Error al obtener estado" });
  }
});

// PATCH /api/driver/status
driverStatusRouter.patch("/status", async (req: any, res) => {
  try {
    const driverId = req.user?.id;
    const { active } = req.body as { active: boolean };
    await db
      .update(drivers)
      .set({ isActive: active })
      .where(eq(drivers.userId, driverId));
    res.json({ ok: true, active });
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar estado" });
  }
});
