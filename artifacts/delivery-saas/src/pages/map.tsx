import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap, type LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, RefreshCw, AlertCircle } from "lucide-react";

type Geo = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: number[][][] } | { type: "MultiPolygon"; coordinates: number[][][][] };
    properties: { name: string; description?: string };
  }>;
};

const ZONE_COLORS = [
  "#00B5E2", "#7CB342", "#F9A825", "#9C27B0", "#C2185B",
  "#0F9D58", "#01579B", "#795548", "#FF7043", "#5E35B1",
];

function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  return `${base}/${path}`;
}

function bboxFromGeoJson(geo: Geo): LngLatBoundsLike | null {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const visit = (lng: number, lat: number) => {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  };
  for (const f of geo.features) {
    if (f.geometry.type === "Polygon") {
      f.geometry.coordinates.forEach((ring) => ring.forEach(([lng, lat]) => visit(lng, lat)));
    } else {
      f.geometry.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(([lng, lat]) => visit(lng, lat))));
    }
  }
  if (!isFinite(minLng)) return null;
  return [[minLng, minLat], [maxLng, maxLat]];
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const fetchZones = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("tiempolibre_token");
      const res = await fetch(apiUrl("api/zones/geojson"), {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Error ${res.status}`);
      }
      const data = (await res.json()) as Geo;
      setGeo(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el mapa de zonas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const mapLoadedRef = useRef(false);

  function enrichGeo(g: Geo): Geo {
    return {
      ...g,
      features: g.features.map((f, i) => ({
        ...f,
        properties: { ...f.properties, color: ZONE_COLORS[i % ZONE_COLORS.length] },
      })),
    };
  }

  function applyGeoToMap(map: MapLibreMap, g: Geo) {
    const enriched = enrichGeo(g);
    const existing = map.getSource("zonas") as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(enriched as never);
    } else {
      map.addSource("zonas", { type: "geojson", data: enriched as never });
      map.addLayer({
        id: "zonas-fill",
        type: "fill",
        source: "zonas",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "zonas-line",
        type: "line",
        source: "zonas",
        paint: { "line-color": ["get", "color"], "line-width": 2.5 },
      });
      map.addLayer({
        id: "zonas-label",
        type: "symbol",
        source: "zonas",
        layout: {
          "text-field": ["concat", "Zona ", ["get", "name"]],
          "text-size": 14,
          "text-anchor": "center",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
      map.on("mousemove", "zonas-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as { name?: string; description?: string };
        const html = `<div style="font-family:system-ui;font-size:13px;line-height:1.4">
          <strong>Zona ${props.name ?? ""}</strong>
          ${props.description ? `<div style="color:#475569;margin-top:4px;max-width:240px">${props.description}</div>` : ""}
        </div>`;
        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
      });
      map.on("mouseleave", "zonas-fill", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    }
    const bounds = bboxFromGeoJson(g);
    if (bounds) map.fitBounds(bounds, { padding: 40, duration: 0 });
  }

  // Init map once, when container + first geo are ready.
  useEffect(() => {
    if (!mapContainer.current || !geo || mapRef.current) return;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: [
                "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
              maxzoom: 19,
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
          glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        },
        center: [-103.42, 20.66],
        zoom: 11,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setMapError(`No se pudo iniciar el mapa interactivo (${msg}). Tu navegador puede no soportar WebGL.`);
      return;
    }
    mapRef.current = map;
    mapLoadedRef.current = false;
    map.on("error", (ev) => {
      const msg = ev?.error?.message ?? "Error en el mapa";
      setMapError(msg);
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    map.on("load", () => {
      mapLoadedRef.current = true;
      if (geo) applyGeoToMap(map, geo);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
    };
  }, [geo === null]);

  // Refresh polygons whenever geo changes (after Recargar).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo) return;
    if (mapLoadedRef.current) {
      applyGeoToMap(map, geo);
    } else {
      map.once("load", () => {
        mapLoadedRef.current = true;
        applyGeoToMap(map, geo);
      });
    }
  }, [geo]);

  const zones = useMemo(
    () =>
      geo?.features.map((f, i) => ({
        name: f.properties.name,
        description: f.properties.description ?? null,
        color: ZONE_COLORS[i % ZONE_COLORS.length] ?? "#00B5E2",
      })) ?? [],
    [geo],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="w-7 h-7 text-primary" />
            Mapa de zonas
          </h1>
          <p className="text-muted-foreground mt-1">
            Polígonos de cobertura cargados desde <code>zonas.kml</code>. Cada nuevo envío valida automáticamente que la
            dirección de entrega caiga dentro de una de estas zonas.
          </p>
        </div>
        <Button variant="outline" onClick={fetchZones} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Recargar
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-md border border-destructive/30 bg-destructive/5 text-sm">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">No se pudo cargar el mapa</p>
            <p className="text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <Card className="overflow-hidden">
          <CardContent className="p-0 relative">
            {loading && !geo ? (
              <Skeleton className="w-full h-[600px]" />
            ) : (
              <>
                <div ref={mapContainer} className="w-full h-[600px]" data-testid="map-canvas-container" />
                {mapError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/95 p-6">
                    <div className="text-center max-w-md">
                      <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="font-medium">Mapa no disponible</p>
                      <p className="text-sm text-muted-foreground mt-2">{mapError}</p>
                      <p className="text-xs text-muted-foreground mt-3">
                        Las zonas siguen funcionando para validar envíos. Listado completo a la derecha.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zonas detectadas ({zones.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {zones.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">Sin polígonos. Sube <code>zonas.kml</code> a la raíz.</p>
            )}
            {zones.map((z) => (
              <div key={z.name} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
                <span className="w-3 h-3 rounded-sm flex-shrink-0 mt-1.5" style={{ background: z.color }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Zona {z.name}</p>
                  {z.description && (
                    <p className="text-xs text-muted-foreground truncate" title={z.description}>
                      {z.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
