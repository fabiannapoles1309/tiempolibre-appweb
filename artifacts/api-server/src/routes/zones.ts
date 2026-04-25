import { Router, type IRouter } from "express";
import { db, zonesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getZonesGeoJson, getMapStatus, loadZones, validarZona } from "../lib/mapService";

const router: IRouter = Router();

router.get("/zones", requireAuth, async (_req, res): Promise<void> => {
  const zones = await db.select().from(zonesTable).orderBy(zonesTable.id);
  res.json(zones);
});

// Sirve el GeoJSON de los polígonos de cobertura para pintar el mapa del Admin.
router.get("/zones/geojson", requireAuth, (_req, res): void => {
  const fc = getZonesGeoJson();
  if (!fc) {
    res.status(503).json({
      error: "Polígonos de zonas no disponibles. Subí zonas.kml a la raíz del proyecto.",
      status: getMapStatus(),
    });
    return;
  }
  res.json(fc);
});

// Estado del servicio de mapas (útil para diagnosticar problemas con el KML).
router.get("/zones/map-status", requireAuth, (_req, res): void => {
  res.json(getMapStatus());
});

// Recarga forzada del KML (sin reiniciar el servidor).
router.post("/zones/reload", requireAuth, (_req, res): void => {
  const s = loadZones(true);
  res.json({ reloaded: !!s, status: getMapStatus() });
});

// Endpoint de prueba: valida una dirección contra los polígonos KML.
router.get("/zones/validate", requireAuth, async (req, res): Promise<void> => {
  const direccion = typeof req.query.direccion === "string" ? req.query.direccion : "";
  if (!direccion) {
    res.status(400).json({ error: "Falta el parámetro 'direccion'" });
    return;
  }
  const result = await validarZona(direccion);
  res.json(result);
});

export default router;
