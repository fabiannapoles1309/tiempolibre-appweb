import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { kml as kmlToGeoJson } from "@tmcw/togeojson";
import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
import {
  useCreateOrder,
  PaymentMethod,
  getListOrdersQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, AlertTriangle, MapPin, Check } from "lucide-react";

const ALLOWED_PAYMENTS = [
  PaymentMethod.EFECTIVO,
  PaymentMethod.TRANSFERENCIA,
  PaymentMethod.TARJETA,
  PaymentMethod.CORTESIA,
] as const;

const orderSchema = z
  .object({
    pickup: z.string().min(1, "La dirección de recolección es requerida"),
    delivery: z.string().min(1, "La dirección de entrega es requerida"),
    recipientPhone: z.string().min(6, "Ingresa el teléfono del destinatario"),
    payment: z.enum(ALLOWED_PAYMENTS, {
      required_error: "Selecciona un método de pago",
    }),
    cashAmount: z.union([z.string(), z.number()]).optional(),
    cashChange: z.union([z.string(), z.number()]).optional(),
    notes: z.string().optional(),
    deliveryLat: z.number().optional(),
    deliveryLng: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.payment === PaymentMethod.EFECTIVO) {
      const amt = Number(data.cashAmount);
      if (!data.cashAmount || Number.isNaN(amt) || amt <= 0) {
        ctx.addIssue({
          path: ["cashAmount"],
          code: z.ZodIssueCode.custom,
          message: "Ingresa el monto a cobrar",
        });
      }
    }
  });

type FormValues = z.infer<typeof orderSchema>;

type Geo = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry:
      | { type: "Polygon"; coordinates: number[][][] }
      | { type: "MultiPolygon"; coordinates: number[][][][] };
    properties: { name?: string };
  }>;
};

function bboxFromGeo(geo: Geo): [[number, number], [number, number]] | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  const visit = (lng: number, lat: number) => {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  };
  for (const f of geo.features) {
    if (f.geometry.type === "Polygon") {
      f.geometry.coordinates.forEach((ring) =>
        ring.forEach(([lng, lat]) => visit(lng, lat)),
      );
    } else {
      f.geometry.coordinates.forEach((poly) =>
        poly.forEach((ring) => ring.forEach(([lng, lat]) => visit(lng, lat))),
      );
    }
  }
  if (!isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function pointInZones(geo: Geo, lng: number, lat: number): string | null {
  const pt = turf.point([lng, lat]);
  for (const f of geo.features) {
    try {
      if (turf.booleanPointInPolygon(pt, f as any)) {
        return f.properties.name ?? "Zona";
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export default function NewOrder() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createMutation = useCreateOrder();

  const mapRef = useRef<MapLibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const [geo, setGeo] = useState<Geo | null>(null);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [matchedZone, setMatchedZone] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [mapUnsupported, setMapUnsupported] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      pickup: "",
      delivery: "",
      recipientPhone: "",
      notes: "",
      cashAmount: "",
      cashChange: "",
    },
  });

  const payment = form.watch("payment");

  // Cargar zonas.kml y parsear a GeoJSON.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base = import.meta.env.BASE_URL ?? "/";
        const res = await fetch(`${base}zonas.kml`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const doc = new XmlDomParser().parseFromString(text, "text/xml") as unknown as Document;
        const fc = kmlToGeoJson(doc) as unknown as Geo;
        const filtered: Geo = {
          type: "FeatureCollection",
          features: fc.features.filter(
            (f) =>
              f.geometry &&
              (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
          ),
        };
        if (!cancelled) setGeo(filtered);
      } catch (err) {
        console.error("No se pudo cargar zonas.kml", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Init map una sola vez cuando geo + container están listos.
  useEffect(() => {
    if (!containerRef.current || !geo || mapRef.current) return;
    // Si el navegador no soporta WebGL, mostramos fallback en vez de crashear.
    try {
      const probe = document.createElement("canvas");
      const gl = (probe.getContext("webgl2") || probe.getContext("webgl")) as WebGLRenderingContext | null;
      if (!gl) {
        setMapUnsupported(true);
        return;
      }
    } catch {
      setMapUnsupported(true);
      return;
    }
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
      container: containerRef.current,
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
    } catch (err) {
      console.error("MapLibre init failed", err);
      setMapUnsupported(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on("load", () => {
      map.addSource("zonas", { type: "geojson", data: geo as any });
      map.addLayer({
        id: "zonas-fill",
        type: "fill",
        source: "zonas",
        paint: { "fill-color": "#00B5E2", "fill-opacity": 0.18 },
      });
      map.addLayer({
        id: "zonas-line",
        type: "line",
        source: "zonas",
        paint: { "line-color": "#0096BD", "line-width": 2 },
      });
      const bb = bboxFromGeo(geo);
      if (bb) map.fitBounds(bb, { padding: 30, duration: 0 });
    });

    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      const matched = pointInZones(geo, lng, lat);
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new maplibregl.Marker({ color: matched ? "#00B5E2" : "#dc2626" })
        .setLngLat([lng, lat])
        .addTo(map);
      setSelectedPoint({ lat, lng });
      form.setValue("deliveryLat", lat);
      form.setValue("deliveryLng", lng);
      if (matched) {
        setMatchedZone(matched);
        setZoneError(null);
      } else {
        setMatchedZone(null);
        setZoneError("Envío fuera de la zona delimitada. Elige un punto dentro de un polígono.");
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [geo, form]);

  const onSubmit = async (data: FormValues) => {
    if (zoneError) {
      toast.error(zoneError);
      return;
    }
    if (!selectedPoint && !mapUnsupported) {
      toast.error("Marca el punto de entrega en el mapa.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          pickup: data.pickup,
          delivery: data.delivery,
          payment: data.payment,
          notes: data.notes ?? null,
          recipientPhone: data.recipientPhone,
          cashAmount:
            data.payment === PaymentMethod.EFECTIVO && data.cashAmount
              ? Number(data.cashAmount)
              : null,
          cashChange:
            data.payment === PaymentMethod.EFECTIVO && data.cashChange
              ? Number(data.cashChange)
              : null,
          deliveryLat: selectedPoint?.lat ?? null,
          deliveryLng: selectedPoint?.lng ?? null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      toast.success("Envío creado exitosamente");
      setLocation("/orders");
    } catch (error: any) {
      const reason = error?.data?.reason;
      if (reason === "NO_SUBSCRIPTION" || reason === "NO_DELIVERIES_LEFT") {
        // La autogestión de suscripción fue removida (M1). Las recargas y
        // renovaciones las hace el administrador desde /admin/clientes.
        toast.error(
          `${error.data.error} — Contacta a tu administrador para recargar tu bloque de envíos.`,
        );
        return;
      }
      toast.error(error.data?.error || "Error al crear el envío");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo envío</h1>
          <p className="text-muted-foreground mt-1">
            Marca el destino sobre el mapa para validar la zona de cobertura.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#00B5E2]" />
              Punto de entrega en el mapa
            </CardTitle>
            <CardDescription>
              Haz clic sobre el mapa donde se entrega el envío. Solo se aceptan puntos dentro de las zonas delimitadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              ref={containerRef}
              className="w-full h-[420px] rounded-md border"
              data-testid="map-new-order"
            />
            {mapUnsupported && (
              <div
                className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-md p-3"
                data-testid="alert-map-unsupported"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>
                  Tu navegador no soporta el mapa interactivo. Puedes crear el envío igualmente: la zona se validará en el servidor a partir de la dirección de entrega.
                </span>
              </div>
            )}
            {zoneError && (
              <div
                className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-300 rounded-md p-3"
                data-testid="alert-zone-error"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>{zoneError}</span>
              </div>
            )}
            {matchedZone && !zoneError && (
              <div
                className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-300 rounded-md p-3"
                data-testid="alert-zone-ok"
              >
                <Check className="w-4 h-4" /> Punto válido dentro de la zona{" "}
                <strong>{matchedZone}</strong>
              </div>
            )}
            {!geo && (
              <p className="text-xs text-muted-foreground">Cargando zonas...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalles del envío</CardTitle>
            <CardDescription>
              Origen, destino, método de pago y datos del destinatario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="pickup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección de recolección</FormLabel>
                      <FormControl>
                        <Input placeholder="Av. Principal 123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delivery"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección de entrega</FormLabel>
                      <FormControl>
                        <Input placeholder="Calle 456, Apto 2B" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recipientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono del destinatario</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+52 ..."
                          data-testid="input-recipient-phone"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de pago</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment">
                            <SelectValue placeholder="Método de pago" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ALLOWED_PAYMENTS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {payment === PaymentMethod.EFECTIVO && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="cashAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monto a cobrar</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="1500"
                              data-testid="input-cash-amount"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cashChange"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vuelto a entregar (opc.)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="0"
                              data-testid="input-cash-change"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas (opcional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Instrucciones para el repartidor..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Link href="/orders">
                    <Button variant="outline" type="button">
                      Cancelar
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    className="bg-[#00B5E2] hover:bg-[#0096BD]"
                    disabled={createMutation.isPending || !!zoneError || (!selectedPoint && !mapUnsupported)}
                    data-testid="button-submit-order"
                  >
                    {createMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Crear envío
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
