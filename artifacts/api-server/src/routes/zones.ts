import { Router, type IRouter } from "express";
import { db, zonesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/zones", requireAuth, async (_req, res): Promise<void> => {
  const zones = await db.select().from(zonesTable).orderBy(zonesTable.id);
  res.json(zones);
});

export default router;
