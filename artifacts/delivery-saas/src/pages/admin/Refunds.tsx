﻿import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, Wallet, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL ?? "";

type Cliente = { id: number; name: string; email: string; businessName: string | null };
type Refund  = {
  id: number; orderId: number; reason: string; percentage: number;
  amount: number; insuranceRefund: boolean; createdAt: string;
  cliente: { user: { name: string; email: string } };
};

const REASONS = [
  { value: "MERMA",     label: "Merma"    },
  { value: "ACCIDENTE", label: "Accidente"},
  { value: "ROBO",      label: "Robo"     },
];

export default function AdminRefundsPage() {
  const qc = useQueryClient();

  // Formulario
  const [orderId,         setOrderId]         = useState("");
  const [clienteId,       setClienteId]       = useState("");
  const [reason,          setReason]          = useState("");
  const [percentage,      setPercentage]      = useState<"30"|"100">("100");
  const [insuranceRefund, setInsuranceRefund] = useState(false);

  // Lista de clientes para selector
  const { data: clientes = [], isLoading: lc } = useQuery<Cliente[]>({
    queryKey: ["refund-clientes"],
    queryFn: async () => {
      const r = await apiFetch(`${API}/api/admin/refunds/clientes`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Historial de reembolsos
  const { data: history = [], isLoading: lh } = useQuery<Refund[]>({
    queryKey: ["refunds-history"],
    queryFn: async () => {
      const r = await apiFetch(`${API}/api/admin/refunds`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch(`${API}/api/admin/refunds`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId:         Number(orderId),
          clienteId:       Number(clienteId),
          reason,
          percentage:      Number(percentage),
          insuranceRefund,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || "Error al procesar reembolso");
      }
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(`✅ Reembolso aplicado — $${data.refundAmount.toFixed(2)} acreditados a la billetera`);
      qc.invalidateQueries({ queryKey: ["refunds-history"] });
      setOrderId(""); setClienteId(""); setReason(""); setInsuranceRefund(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = orderId && clienteId && reason && !mutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <RotateCcw className="w-7 h-7 text-[#00B5E2]" /> Reembolsos
        </h1>
        <p className="text-muted-foreground mt-1">
          Aplica un reembolso del costo de envío ante incidentes.
          El monto se acredita automáticamente en la billetera del cliente.
        </p>
      </div>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#00B5E2]" /> Aplicar reembolso
          </CardTitle>
          <CardDescription>
            Selecciona el pedido, el motivo y el porcentaje a devolver.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ID del pedido */}
            <div className="space-y-1">
              <Label>ID del pedido</Label>
              <Input
                type="number"
                placeholder="Ej: 1042"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
            </div>

            {/* Selector de cliente */}
            <div className="space-y-1">
              <Label>Cliente a reembolsar</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder={lc ? "Cargando..." : "Selecciona cliente"} />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.businessName || c.name} — {c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Motivo */}
            <div className="space-y-1">
              <Label>Motivo de devolución</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona motivo" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Porcentaje */}
            <div className="space-y-1">
              <Label>Monto a devolver</Label>
              <Select value={percentage} onValueChange={(v) => setPercentage(v as "30"|"100")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30% del costo de envío</SelectItem>
                  <SelectItem value="100">100% del costo de envío</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seguro de reparto */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
            <input
              type="checkbox"
              id="insurance"
              checked={insuranceRefund}
              onChange={(e) => setInsuranceRefund(e.target.checked)}
              className="w-4 h-4 accent-[#00B5E2]"
            />
            <Label htmlFor="insurance" className="cursor-pointer">
              Incluir también el monto del seguro de reparto
            </Label>
          </div>

          {/* Alerta informativa */}
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              El monto calculado se acreditará de forma inmediata en la billetera del cliente seleccionado.
              Esta acción no se puede deshacer.
            </span>
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="bg-[#00B5E2] hover:bg-[#009ec8] text-white w-full md:w-auto"
          >
            {mutation.isPending ? "Procesando..." : "Aplicar reembolso"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de reembolsos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Seguro</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lh ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No hay reembolsos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.cliente?.user?.name}</span>
                          <span className="text-xs text-muted-foreground">{r.cliente?.user?.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>#{r.orderId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.reason}</Badge>
                      </TableCell>
                      <TableCell>{r.percentage}%</TableCell>
                      <TableCell className="font-mono font-medium text-green-600">
                        ${r.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {r.insuranceRefund
                          ? <Badge className="bg-blue-600 text-white hover:bg-blue-600">Sí</Badge>
                          : <span className="text-muted-foreground">No</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(r.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
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



