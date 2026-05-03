import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PackagePlus, Check, X, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL ?? "";

type Req = {
  id: number;
  status: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  requestedAt: string;
  processedAt: string | null;
  processedNotes: string | null;
  cliente: {
    userId: number;
    name: string;
    email: string;
    businessName: string | null;
  };
  processedBy: {
    userId: number;
    name: string;
    email: string;
  } | null;
};

function statusBadge(s: Req["status"]) {
  if (s === "PENDIENTE")
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Pendiente</Badge>;
  if (s === "APROBADA")
    return <Badge className="bg-green-600 hover:bg-green-600 text-white">Aprobada</Badge>;
  return <Badge variant="destructive">Rechazada</Badge>;
}

export default function AdminPackageRequestsPage() {
  const qc = useQueryClient();
  const { data: pending = [], isLoading: lp } = useQuery<Req[]>({
    queryKey: ["admin-package-requests", "PENDIENTE"],
    queryFn: async () => {
      const r = await apiFetch(`${API}/api/admin/package-requests?status=PENDIENTE`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 15_000,
  });
  const { data: history = [], isLoading: lh } = useQuery<Req[]>({
    queryKey: ["admin-package-requests", "ALL"],
    queryFn: async () => {
      const r = await apiFetch(`${API}/api/admin/package-requests`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  const [busyId, setBusyId] = useState<number | null>(null);
  const act = async (id: number, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      const r = await apiFetch(`${API}/api/admin/package-requests/${id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast.error(err?.error || "No se pudo procesar la solicitud");
      } else {
        toast.success(
          action === "approve"
            ? "Solicitud aprobada y paquete recargado (+35 envíos)"
            : "Solicitud rechazada",
        );
        qc.invalidateQueries({ queryKey: ["admin-package-requests"] });
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <PackagePlus className="w-7 h-7 text-[#00B5E2]" /> Solicitudes de paquete
        </h1>
        <p className="text-muted-foreground mt-1">
          Aprueba o rechaza las solicitudes de recarga de paquete (+35 envíos)
          enviadas por los clientes desde su billetera.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" /> Pendientes
          </CardTitle>
          <CardDescription>
            Aprobar recarga +35 envíos al último plan ACTIVA/VENCIDA del
            cliente. Rechazar simplemente cierra la solicitud sin recargar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Solicitada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lp ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 3 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : pending.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No hay solicitudes pendientes.
                    </TableCell>
                  </TableRow>
                ) : (
                  pending.map((r) => (
                    <TableRow key={r.id} data-testid={`row-pending-${r.id}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {r.cliente.businessName || r.cliente.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {r.cliente.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(r.requestedAt), "dd MMM yyyy, HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            size="sm"
                            disabled={busyId === r.id}
                            onClick={() => act(r.id, "approve")}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`button-approve-${r.id}`}
                          >
                            {busyId === r.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" /> Aprobar
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busyId === r.id}
                            onClick={() => act(r.id, "reject")}
                            data-testid={`button-reject-${r.id}`}
                          >
                            <X className="w-4 h-4 mr-1" /> Rechazar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
          <CardDescription>Últimas 500 solicitudes en cualquier estado.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Solicitada</TableHead>
                  <TableHead>Procesada</TableHead>
                  <TableHead>Procesado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lh ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aún no hay solicitudes registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((r) => (
                    <TableRow key={`h-${r.id}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {r.cliente.businessName || r.cliente.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {r.cliente.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(r.requestedAt), "dd MMM yyyy, HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.processedAt
                          ? format(new Date(r.processedAt), "dd MMM yyyy, HH:mm", { locale: es })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-processed-by-${r.id}`}>
                        {r.processedBy ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{r.processedBy.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {r.processedBy.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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

