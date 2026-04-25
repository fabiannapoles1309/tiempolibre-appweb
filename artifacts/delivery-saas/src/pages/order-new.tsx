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
  useGetMyCustomerProfile,
  PaymentMethod,
  getListOrdersQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
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

// Métodos de pago disponibles según el rol.
// Para CLIENTE eliminamos BILLETERA porque la auto-recarga de saldo
// fue retirada del flujo del cliente (ahora sólo solicita un paquete extra).
const PAYMENTS_BY_ROLE: Record<string, readonly PaymentMethod[]> = {
  ADMIN: [
    PaymentMethod.EFECTIVO,
    PaymentMethod.TRANSFERENCIA,
    PaymentMethod.BILLETERA,
    PaymentMethod.TARJETA,
    PaymentMethod.CORTESIA,
  ],
  SUPERUSER: [
    PaymentMethod.EFECTIVO,
    PaymentMethod.TRANSFERENCIA,
    PaymentMethod.BILLETERA,
    PaymentMethod.TARJETA,
    PaymentMethod.CORTESIA,
  ],
  CLIENTE: [
    PaymentMethod.EFECTIVO,
    PaymentMethod.TRANSFERENCIA,
    PaymentMethod.TARJETA,
    PaymentMethod.CORTESIA,
  ],
};
const ALL_PAYMENTS = [
  PaymentMethod.EFECTIVO,
  PaymentMethod.TRANSFERENCIA,
  PaymentMethod.BILLETERA,
  PaymentMethod.TARJETA,
  PaymentMethod.CORTESIA,
] as const;

const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  BILLETERA: "Billetera",
  TARJETA: "Tarjeta",
  CORTESIA: "Cortesía (sin costo)",
};

const orderSchema = z
  .object({
    pickup: z.string().min(1, "La dirección de recolección es requerida"),
    delivery: z.string().min(1, "La dirección de entrega es requerida"),
    recipientPhone: z.string().min(6, "Ingresa el teléfono del destinatario"),
    payment: z.enum(ALL_PAYMENTS, {
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

// Canonicaliza el nombre de zona del KML a sólo el número (ej: "ZONA 1" -> "1").
// Debe coincidir con el `customers.zone` (entero) que devuelve /me/customer
// y con la normalización del backend en mapService.ts.
function canonicalZoneName(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  const m = s.match(/\d+/);
  return m ? m[0] : s.trim();
}

function pointInZones(geo: Geo, lng: number, lat: number): string | null {
  const pt = turf.point([lng, lat]);
  for (const f of geo.features) {
    try {
      if (turf.booleanPointInPolygon(pt, f as any)) {
        return canonicalZoneName(f.properties.name) || "Zona";
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
  const { user } = useAuth();
  const role = user?.role ?? "CLIENTE";
  const isCliente = role === "CLIENTE";

  // Para CLIENTE consultamos su perfil para conocer la zona asignada y
  // restringir el mapa. ADMIN/SUPERUSER no tienen restricción: la consulta
  // siempre se ejecuta (el endpoint devuelve campos nulos para no-CLIENTE).
  const { data: profile, isFetched: profileFetched } = useGetMyCustomerProfile();
  const clienteZone =
    isCliente && profile?.clienteZone != null ? String(profile.clienteZone) : null;
  // El CLIENTE necesita una zona asignada para poder operar. Si la consulta
  // ya terminó y no hay zona, mostramos un aviso en lugar de quedarnos en
  // "Cargando zonas..." indefinidamente.
  const noAssignedZone = isCliente && profileFetched && !clienteZone;

  // Lista de métodos de pago visibles según rol (CLIENTE no ve BILLETERA).
  const allowedPayments = PAYMENTS_BY_ROLE[role] ?? PAYMENTS_BY_ROLE.CLIENTE;

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

  // Para CLIENTE el domicilio de recolección está fijado en su perfil y se
  // pre-llena automáticamente cuando llega `/me/customer`. El campo del
  // formulario queda en sólo-lectura. ADMIN puede editar libremente.
  const lockedPickup =
    isCliente && profile?.pickupAddress ? profile.pickupAddress : "";
  useEffect(() => {
    if (lockedPickup && form.getValues("pickup") !== lockedPickup) {
      form.setValue("pickup", lockedPickup, { shouldValidate: true });
    }
  }, [lockedPickup, form]);

  // Cargar zonas.kml y parsear a GeoJSON.
  // Para CLIENTE filtramos los polígonos al de su zona asignada, así sólo
  // puede seleccionar puntos dentro del área autorizada. Esperamos a que
  // `clienteZone` esté disponible antes de inicializar el mapa.
  useEffect(() => {
    let cancelled = false;
    if (isCliente && clienteZone === null) return; // aún cargando perfil
    (async () => {
      try {
        const base = import.meta.env.BASE_URL ?? "/";
        const res = await fetch(`${base}zonas.kml`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const doc = new XmlDomParser().parseFromString(text, "text/xml") as unknown as Document;
        const fc = kmlToGeoJson(doc) as unknown as Geo;
        let features = fc.features.filter(
          (f) =>
            f.geometry &&
            (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
        );
        if (isCliente && clienteZone) {
          features = features.filter(
            (f) => canonicalZoneName(f.properties.name) === clienteZone,
          );
        }
        const filtered: Geo = { type: "FeatureCollection", features };
        if (!cancelled) setGeo(filtered);
      } catch (err) {
        console.error("No se pudo cargar zonas.kml", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCliente, clienteZone]);

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
      if (!matched) {
        setMatchedZone(null);
        if (isCliente && clienteZone) {
          setZoneError(
            `Tu zona registrada es la Zona ${clienteZone}. Sólo puedes elegir un punto dentro de esa zona.`,
          );
        } else {
          setZoneError(
            "Envío fuera de la zona delimitada. Elige un punto dentro de un polígono.",
          );
        }
        return;
      }
      // Para CLIENTE además debe coincidir con su zona asignada.
      if (isCliente && clienteZone && matched !== clienteZone) {
        setMatchedZone(null);
        setZoneError(
          `Tu zona registrada es la Zona ${clienteZone}. El punto elegido cae en la Zona ${matched}.`,
        );
        return;
      }
      setMatchedZone(matched);
      setZoneError(null);
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
            {noAssignedZone ? (
              <div
                className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-md p-3"
                data-testid="alert-no-zone"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>
                  Tu cuenta aún no tiene una zona asignada. Contacta a tu
                  administrador para activarla.
                </span>
              </div>
            ) : (
              !geo && (
                <p className="text-xs text-muted-foreground">Cargando zonas...</p>
              )
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
                        <Input
                          placeholder="Av. Principal 123"
                          {...field}
                          readOnly={isCliente}
                          disabled={isCliente && !lockedPickup}
                          className={isCliente ? "bg-muted cursor-not-allowed" : undefined}
                          data-testid="input-pickup"
                        />
                      </FormControl>
                      {isCliente && (
                        <p className="text-xs text-muted-foreground" data-testid="text-pickup-locked">
                          Este es tu domicilio de recolección registrado y no se
                          puede modificar. Si necesitas cambiarlo, contacta a tu
                          administrador.
                        </p>
                      )}
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
                          {allowedPayments.map((p) => (
                            <SelectItem key={p} value={p}>
                              {PAYMENT_LABELS[p] ?? p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {payment === PaymentMethod.CORTESIA && (
                  <div
                    className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-sm"
                    data-testid="cortesia-notice"
                  >
                    Servicio de cortesía: el costo del envío es <strong>$0.00</strong>,
                    pero <strong>sí descuenta un envío del bloque mensual</strong> del
                    cliente.
                  </div>
                )}

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
