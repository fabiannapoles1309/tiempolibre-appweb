﻿import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
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
  useGetMySubscription,
  PaymentMethod,
  getListOrdersQueryKey,
  getGetDashboardQueryKey,
  getGetMySubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
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
    recipientName: z.string().min(2, "Captura el nombre del destinatario"),
    recipientPhone: z.string().min(6, "Ingresa el teléfono del destinatario"),
    recipientEmail: z
      .string()
      .trim()
      .max(255, "El correo es demasiado largo")
      .email("El correo no tiene un formato válido")
      .optional()
      .or(z.literal("")),
    allowMarketingSms: z.boolean().optional().default(false),
    allowMarketingEmail: z.boolean().optional().default(false),
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
  const { data: mySubData } = useGetMySubscription({
    query: {
      enabled: user?.role === "CLIENTE",
      queryKey: getGetMySubscriptionQueryKey(),
    },
  });
  const mySub = mySubData?.subscription ?? null;
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
      recipientName: "",
      recipientPhone: "",
      recipientEmail: "",
      allowMarketingSms: false,
      allowMarketingEmail: false,
      notes: "",
      cashAmount: "",
      cashChange: "",
    },
  });

  const payment = form.watch("payment");
  const recipientPhoneVal = form.watch("recipientPhone");

  // Directorio de destinatarios del cliente (sólo para CLIENTE). Se usa para
  // autollenar el nombre + consentimientos cuando el teléfono coincide con
  // un destinatario previamente registrado.
  type RecipientRow = {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    allowMarketingSms: boolean;
    allowMarketingEmail: boolean;
    orderCount: number;
    lastUsedAt: string;
  };
  const { data: myRecipients = [] } = useQuery<RecipientRow[]>({
    enabled: isCliente,
    queryKey: ["my-recipients"],
    queryFn: async () => {
      const r = await apiFetch("/api/me/recipients", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });
  const phoneIndex = useMemo(() => {
    const m = new Map<string, RecipientRow>();
    for (const r of myRecipients) m.set(r.phone, r);
    return m;
  }, [myRecipients]);

  // Cuando el teléfono coincide exacto con uno conocido, autollenamos el
  // nombre + consentimientos (sólo si el nombre todavía no fue tipeado a
  // mano por el usuario).
  useEffect(() => {
    if (!isCliente || !recipientPhoneVal) return;
    const match = phoneIndex.get(recipientPhoneVal.trim());
    if (!match) return;
    const currentName = (form.getValues("recipientName") ?? "").trim();
    if (!currentName || currentName === match.name) {
      form.setValue("recipientName", match.name, { shouldValidate: true });
      form.setValue("allowMarketingSms", match.allowMarketingSms);
      form.setValue("allowMarketingEmail", match.allowMarketingEmail);
      // Sólo autollenamos el email si el campo está vacío (no clobereamos
      // un correo que el cliente esté tipeando para este envío).
      const currentEmail = (form.getValues("recipientEmail") ?? "").trim();
      if (!currentEmail && match.email) {
        form.setValue("recipientEmail", match.email, { shouldValidate: true });
      }
    }
  }, [isCliente, recipientPhoneVal, phoneIndex, form]);

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
        const res = await apiFetch(`${base}zonas.kml`);
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
        // Los campos `recipientName` + `allowMarketing*` aún no están en el
        // OpenAPI generado; el backend los acepta como opcionales. Casteamos
        // a `any` para sortear el chequeo estricto sin regenerar el cliente.
        data: {
          pickup: data.pickup,
          delivery: data.delivery,
          payment: data.payment,
          notes: data.notes ?? null,
          recipientPhone: data.recipientPhone,
          recipientName: data.recipientName,
          recipientEmail: (data.recipientEmail ?? "").trim() || null,
          allowMarketingSms: !!data.allowMarketingSms,
          allowMarketingEmail: !!data.allowMarketingEmail,
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
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      // El backend descuenta 1 envío del bloque al crear la solicitud,
      // así que invalidamos la query de la suscripción para que el contador
      // se refresque en toda la app (sidebar, dashboard, esta página).
      queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() });
      // Aviso pro-activo cuando el contador toca 5 o menos. Lo calculamos
      // a partir del valor actual antes de la creación; si era 6, ahora son 5.
      if (user?.role === "CLIENTE" && mySub) {
        const newRemaining = Math.max(0, mySub.remainingDeliveries - 1);
        if (newRemaining === 0) {
          toast.warning(
            "Envío creado, pero te quedaste sin envíos disponibles. Solicita una recarga.",
            { duration: 6000 },
          );
        } else if (newRemaining <= 5) {
          toast.warning(
            `Envío creado. Te quedan sólo ${newRemaining} envíos del bloque mensual.`,
            { duration: 6000 },
          );
        } else {
          toast.success("Envío creado exitosamente");
        }
      } else {
        toast.success("Envío creado exitosamente");
      }
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

      {isCliente && mySub && (
        <div
          className={`flex items-center justify-between gap-4 rounded-lg border p-4 ${
            mySub.remainingDeliveries === 0
              ? "border-red-300 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200"
              : mySub.remainingDeliveries <= 5
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
                : "border-border bg-muted/30"
          }`}
          data-testid="banner-deliveries-counter"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={`h-5 w-5 ${
                mySub.remainingDeliveries <= 5 ? "block" : "hidden"
              }`}
            />
            <div>
              <div className="text-sm font-semibold">
                Envíos disponibles del bloque mensual
              </div>
              <div className="text-xs opacity-80">
                {mySub.remainingDeliveries === 0
                  ? "Te quedaste sin envíos. Pide una recarga al administrador."
                  : mySub.remainingDeliveries <= 5
                    ? "Tu bloque está por agotarse. Pide una recarga."
                    : `Plan ${mySub.tier} — ${mySub.usedDeliveries} / ${mySub.monthlyDeliveries} consumidos.`}
              </div>
            </div>
          </div>
          <div
            className="text-3xl font-bold tabular-nums"
            data-testid="text-order-new-remaining"
          >
            {mySub.remainingDeliveries}
          </div>
        </div>
      )}

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
                  name="recipientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del destinatario</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej. María López"
                          data-testid="input-recipient-name"
                          {...field}
                        />
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
                  name="recipientEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Correo electrónico del destinatario{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="destinatario@ejemplo.com"
                          data-testid="input-recipient-email"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isCliente && (
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <p className="text-sm font-medium">
                      Consentimientos del destinatario (opcional)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Marca sólo si el destinatario aceptó recibir comunicaciones
                      promocionales en este número o correo. Se guarda en tu
                      directorio para próximos envíos.
                    </p>
                    <FormField
                      control={form.control}
                      name="allowMarketingSms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={(v) => field.onChange(!!v)}
                              data-testid="checkbox-marketing-sms"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">
                            Acepta recibir SMS promocionales
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="allowMarketingEmail"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={(v) => field.onChange(!!v)}
                              data-testid="checkbox-marketing-email"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">
                            Acepta recibir correos promocionales
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

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
                    disabled={createMutation.isPending}
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



