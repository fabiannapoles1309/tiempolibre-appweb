import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import { kml as kmlToGeoJson } from "@tmcw/togeojson";
import { booleanPointInPolygon, point } from "@turf/turf";
import type { Feature, FeatureCollection, Polygon, MultiPolygon, Point } from "geojson";
import { logger } from "./logger";

type ZonePolygonFeature = Feature<Polygon | MultiPolygon, { name: string; [k: string]: unknown }>;

// Minimal structural type so we don't need lib.dom in tsconfig.
type DomDocLike = Parameters<typeof kmlToGeoJson>[0];

interface MapServiceState {
  geojson: FeatureCollection<Polygon | MultiPolygon>;
  features: ZonePolygonFeature[];
  source: string;
  loadedAt: Date;
}

let state: MapServiceState | null = null;
let lastError: string | null = null;

function findKmlPath(): string | null {
  const candidates = [
    resolve(process.cwd(), "zonas.kml"),
    resolve(process.cwd(), "../../zonas.kml"),
    resolve(process.cwd(), "../zonas.kml"),
    resolve(process.cwd(), "attached_assets/zonas.kml"),
  ];
  for (const p of candidates) {
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

function normalizeName(raw: unknown, idx: number): string {
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  return String(idx + 1);
}

export function loadZones(force = false): MapServiceState | null {
  if (state && !force) return state;
  const path = findKmlPath();
  if (!path) {
    lastError = "zonas.kml no encontrado en la raíz del proyecto";
    logger.warn({ msg: lastError });
    return null;
  }
  try {
    const xml = readFileSync(path, "utf8");
    // @xmldom/xmldom DOMParser is a structural superset of the lib.dom DOMParser used by @tmcw/togeojson
    const doc = new DOMParser().parseFromString(xml, "text/xml") as unknown as DomDocLike;
    const fc = kmlToGeoJson(doc) as FeatureCollection;
    const polys: ZonePolygonFeature[] = [];
    fc.features.forEach((f: Feature, i: number) => {
      if (!f.geometry) return;
      if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") return;
      const props = (f.properties ?? {}) as Record<string, unknown>;
      const name = normalizeName(props.name ?? props.Name ?? props.NAME, i);
      polys.push({
        type: "Feature",
        geometry: f.geometry as Polygon | MultiPolygon,
        properties: { ...props, name },
      });
    });
    if (polys.length === 0) {
      lastError = "No se encontraron polígonos en zonas.kml";
      logger.warn({ msg: lastError, path });
      return null;
    }
    state = {
      geojson: { type: "FeatureCollection", features: polys },
      features: polys,
      source: path,
      loadedAt: new Date(),
    };
    lastError = null;
    logger.info({ msg: "Zonas KML cargadas", path, count: polys.length });
    return state;
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Error leyendo zonas.kml";
    logger.error({ err }, "No se pudo leer zonas.kml");
    return null;
  }
}

export function getZonesGeoJson(): FeatureCollection<Polygon | MultiPolygon> | null {
  return loadZones()?.geojson ?? null;
}

export function getMapStatus(): { loaded: boolean; source: string | null; zoneCount: number; error: string | null } {
  const s = state ?? loadZones();
  return {
    loaded: !!s,
    source: s?.source ?? null,
    zoneCount: s?.features.length ?? 0,
    error: lastError,
  };
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeNominatim(direccion: string): Promise<GeocodeResult | null> {
  const q = direccion.trim();
  if (!q) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ar");
  url.searchParams.set("addressdetails", "0");
  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim usage policy requires a descriptive User-Agent
        "User-Agent": "TiempoLibre/1.0 (logistica@tiempolibre.com.ar)",
        "Accept-Language": "es",
      },
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "Nominatim respondió con error");
      return null;
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const hit = data[0];
    if (!hit) return null;
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      displayName: hit.display_name,
    };
  } catch (err) {
    logger.error({ err }, "Falla en geocoding Nominatim");
    return null;
  }
}

export interface ValidationResult {
  ok: boolean;
  zone: string | null;
  point?: { lat: number; lng: number };
  reason?: "ZONAS_NO_CARGADAS" | "DIRECCION_NO_GEOCODIFICADA" | "FUERA_DE_ZONA";
  displayName?: string;
}

export async function validarZona(direccion: string): Promise<ValidationResult> {
  const s = loadZones();
  if (!s) return { ok: false, zone: null, reason: "ZONAS_NO_CARGADAS" };
  const geo = await geocodeNominatim(direccion);
  if (!geo) return { ok: false, zone: null, reason: "DIRECCION_NO_GEOCODIFICADA" };
  const pt: Feature<Point> = point([geo.lng, geo.lat]);
  for (const f of s.features) {
    if (booleanPointInPolygon(pt, f)) {
      return {
        ok: true,
        zone: f.properties.name,
        point: { lat: geo.lat, lng: geo.lng },
        displayName: geo.displayName,
      };
    }
  }
  return {
    ok: false,
    zone: null,
    point: { lat: geo.lat, lng: geo.lng },
    reason: "FUERA_DE_ZONA",
    displayName: geo.displayName,
  };
}
