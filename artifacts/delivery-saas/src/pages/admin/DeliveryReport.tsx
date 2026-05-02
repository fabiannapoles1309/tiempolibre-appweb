import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Download, Clock, Filter } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL ?? "";

type OrderReport = {
  id:             number;
  cliente:        string;
  clienteEmail:   string;
  driver:         string;
  status:         string;
  createdAt:      string;
  minutesInRoute: number | null;
  shippingCost:   number;
  paymentMethod:  string;
  cashAmount:     number;
  cardAmount:     number;
  transferAmount: number;
  insuranceAmount:number;
};

type Cliente = { id: number; name: string; email: string; businessName: string | null };

function statusBadge(s: string) {
  const map: Record<string, string> = {
    ENTREGADO: "bg-green-600",
    EN_RUTA:   "bg-blue-500",
    PENDIENTE: "bg-amber-500",
    CANCELADO: "bg-red-500",
  };
  return (
    <Badge className={`${map[s] ?? "bg-gray-400"} hover:opacity-90 text-white`}>
      {s}
    </Badge>
  );
}

function payBadge(m: string) {
  const map: Record<string, string> = {
    EFECTIVO:      "bg-green-100 text-green-800",
    TARJETA:       "bg-purple-100 text-purple-800",
    TRANSFERENCIA: "bg-blue-100 text-blue-800",
  };
  return (
    <Badge variant="outline" className={map[m] ?? ""}>
      {m}
    </Badge>
  );
}

export default function DeliveryReportPage({ userRole }: { userRole?: string }) {
  const isAdmin = userRole === "ADMIN" || userRole === "SUPERADMIN";

  const [clienteId, setClienteId] = useState<string>("ALL");
  const [from,      setFrom]      = useState("");
  const [to,        setTo]        = useState("");
  const [filtered,  setFiltered]  = useState(false);

  // Lista de clientes (solo admin/superadmin)
  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["report-clientes"],
    enabled:  isAdmin,
    queryFn:  async () => {
      const r = await apiFetch(`${API}/api/admin/refunds/clientes`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Reporte de entregas
  const params = new URLSearchParams();
  if (clienteId !== "ALL") params.set("clienteId", clienteId);
  if (from)               params.set("from", from);
  if (to)                 params.set("to",   to);

  const { data: orders = [], isLoading, refetch } = useQuery<OrderReport[]>({
    queryKey: ["delivery-report", clienteId, from, to],
    queryFn:  async () => {
      const r = await apiFetch(`${API}/api/admin/reports/deliveries?${params}`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: filtered,
  });

  // Descargar Excel
  const downloadExcel = async () => {
    try {
      const r = await apiFetch(`${API}/api/admin/reports/excel?${params}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Error al generar Excel");
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `reporte-tiempolibre-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("✅ Excel descargado correctamente");
    } catch {
      toast.error("Error al descargar el reporte");
    }
  };

  // Totales
  const totalEfectivo      = orders.reduce((s, o) => s + o.cashAmount,      0);
  const totalTarjeta       = orders.reduce((s, o) => s + o.cardAmount,       0);
  const totalTransferencia = orders.reduce((s, o) => s + o.transferAmount,   0);
  const totalEnvios        = orders.reduce((s, o) => s + o.shippingCost,     0);
  const avgMinutes         = orders.filter((o) => o.minutesInRoute !== null).length > 0
    ? Math.round(
        orders.reduce((s, o) => s + (o.minutesInRoute ?? 0), 0) /
        orders.filter((o) => o.minutesInRoute !== null).length
      )
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-[#00B5E2]" /> Reporte de entregas
        </h1>
        <p className="text-muted-foreground mt-1">
          Tiempos de entrega, recaudación y detalle por método de pago.
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="w-4 h-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            {isAdmin && (
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los clientes</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.businessName || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Desde</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={() => { setFiltered(true); refetch(); }}
                className="bg-[#00B5E2] hover:bg-[#009ec8] text-white flex-1"
              >
                Generar reporte
              </Button>
              <Button
                variant="outline"
                onClick={downloadExcel}
                disabled={orders.length === 0}
                title="Descargar Excel"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas de resumen */}
      {orders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total envíos",        value: `$${totalEnvios.toFixed(2)}`,        color: "text-[#00B5E2]" },
            { label: "Efectivo",            value: `$${totalEfectivo.toFixed(2)}`,      color: "text-green-600" },
            { label: "Tarjeta",             value: `$${totalTarjeta.toFixed(2)}`,       color: "text-purple-600" },
            { label: "Transferencia",       value: `$${totalTransferencia.toFixed(2)}`, color: "text-blue-600" },
            { label: "Tiempo prom. entrega",value: avgMinutes !== null ? `${avgMinutes} min` : "—", color: "text-amber-600" },
          ].map((card) => (
            <Card key={card.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className={`text-xl font-bold font-mono ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabla de detalle */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de pedidos</CardTitle>
          <CardDescription>
            {orders.length} pedido{orders.length !== 1 ? "s" : ""} encontrado{orders.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Minutos
                  </TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Efectivo</TableHead>
                  <TableHead>Tarjeta</TableHead>
                  <TableHead>Transf.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 11 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                      {filtered
                        ? "No hay pedidos con los filtros seleccionados."
                        : "Selecciona filtros y presiona Generar reporte."}
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">#{o.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{o.cliente}</span>
                          <span className="text-xs text-muted-foreground">{o.clienteEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{o.driver || "—"}</TableCell>
                      <TableCell>{statusBadge(o.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(o.createdAt), "dd MMM yy, HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-center">
                        {o.minutesInRoute !== null ? (
                          <span className={`font-mono font-medium ${
                            o.minutesInRoute > 40 ? "text-red-500" :
                            o.minutesInRoute > 25 ? "text-amber-500" : "text-green-600"
                          }`}>
                            {o.minutesInRoute} min
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="font-mono">${o.shippingCost.toFixed(2)}</TableCell>
                      <TableCell>{payBadge(o.paymentMethod)}</TableCell>
                      <TableCell className="font-mono text-green-700">
                        {o.cashAmount > 0 ? `$${o.cashAmount.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-purple-700">
                        {o.cardAmount > 0 ? `$${o.cardAmount.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-blue-700">
                        {o.transferAmount > 0 ? `$${o.transferAmount.toFixed(2)}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
