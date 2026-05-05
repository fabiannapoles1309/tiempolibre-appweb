import { Router, type IRouter } from "express";
import { db, zonesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { getZonesGeoJson, getMapStatus, loadZones, validarZona } from "../lib/mapService";
const router: IRouter = Router();

router.get("/zones/status", (_req, res) => {
  const status = getMapStatus();
  res.json(status);
});
router.get("/zones", requireAuth, requireRole("ADMIN", "SUPERUSER"), async (_req, res) => {
  const zones = await db.select().from(zonesTable).orderBy(zonesTable.id);
  res.json(zones);
});
router.get("/zones/geojson", requireAuth, requireRole("ADMIN", "CLIENTE", "SUPERUSER", "cliente"), (_req, res) => {
  const fc = getZonesGeoJson();
  if (!fc) return res.status(503).json({ error: "No hay poligonos disponibles" });
  res.json(fc);
});
router.get("/zones/validate", requireAuth, requireRole("ADMIN", "CLIENTE", "SUPERUSER", "cliente"), async (req, res) => {
  const direccion = typeof req.query.direccion === "string" ? req.query.direccion : "";
  const result = await validarZona(direccion);
  res.json(result);
});
export default router;
