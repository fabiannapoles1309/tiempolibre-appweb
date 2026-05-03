﻿import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSubscriptions,
  useGetPricingSettings,
  getListSubscriptionsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Crown, Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  ACTIVA: "bg-green-100 text-green-700 border-green-300",
  CANCELADA: "bg-gray-100 text-gray-700 border-gray-300",
  VENCIDA: "bg-red-100 text-red-700 border-red-300",
};

type TierValue = "ESTANDAR" | "OPTIMO";

export default function AdminSubscriptionsPage() {
  const qc = useQueryClient();
  const { data: subs = [], isLoading } = useListSubscriptions();
  const { data: pricing } = useGetPricingSettings();
  const extraPackagePrice = pricing?.extraPackagePrice ?? 0;

  // Cambio de tier: PATCH /admin/clientes/:id { tier }. El servidor preserva
  // los envíos comprados — sólo cambia tier y monthlyPrice de la suscripción
  // ACTIVA del cliente.
  const [busyTierId, setBusyTierId] = useState<number | null>(null);
  const handleTierChange = async (userId: number, tier: TierValue) => {
    setBusyTierId(userId);
    try {
      const r = await apiFetch(`/api/admin/clientes/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast.error(err?.error || "No se pudo cambiar el plan");
      } else {
        toast.success(`Plan actualizado a ${tier}`);
        qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setBusyTierId(null);
    }
  };

  // Asignación directa de paquete extra (sin solicitud previa del cliente).
  const [assignTarget, setAssignTarget] = useState<{
    userId: number;
    userName: string;
  } | null>(null);
  const [assigning, setAssigning] = useState(false);
  const submitAssign = async () => {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      const r = await apiFetch(
        `/api/admin/clientes/${assignTarget.userId}/assign-package`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast.error(err?.error || "No se pudo asignar el paquete");
      } else {
        toast.success(`Paquete asignado a ${assignTarget.userName} (+35 envíos)`);
        qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
        setAssignTarget(null);
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="w-7 h-7 text-[#00B5E2]" /> Suscripciones
        </h1>
        <p className="text-muted-foreground mt-1">
          Cambiá el plan de cada cliente y asignale paquetes extras de 35
          envíos sin necesidad de que él los solicite.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Planes activos</CardTitle>
          <span className="text-sm text-muted-foreground">
            Costo por paquete extra:{" "}
            <span className="font-semibold text-[#0096BD]">
              $ {extraPackagePrice.toLocaleString("es-MX")}
            </span>{" "}
            (+35 envíos)
          </span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          ) : subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay suscripciones registradas todavía.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-4">Cliente</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4 text-right">Envíos</th>
                    <th className="py-2 pr-4">Período</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => {
                    const isActive = s.status === "ACTIVA";
                    return (
                      <tr key={s.id} className="border-b">
                        <td className="py-2 pr-4 font-medium">{s.userName}</td>
                        <td className="py-2 pr-4">
                          {isActive ? (
                            <Select
                              value={s.tier}
                              disabled={busyTierId === s.userId}
                              onValueChange={(v) =>
                                handleTierChange(s.userId, v as TierValue)
                              }
                            >
                              <SelectTrigger
                                className="w-[140px] h-8"
                                data-testid={`select-tier-${s.userId}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ESTANDAR">Estándar</SelectItem>
                                <SelectItem value="OPTIMO">Óptimo</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span>{s.tier}</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {s.usedDeliveries} / {s.monthlyDeliveries}
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {new Date(s.periodStart).toLocaleDateString("es-MX")}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant="outline"
                            className={STATUS_COLOR[s.status] ?? ""}
                          >
                            {s.status}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!isActive}
                            onClick={() =>
                              setAssignTarget({
                                userId: s.userId,
                                userName: s.userName,
                              })
                            }
                            data-testid={`button-assign-package-${s.userId}`}
                          >
                            <PackagePlus className="w-4 h-4 mr-1" />
                            Asignar paquete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={assignTarget !== null}
        onOpenChange={(open) => !open && setAssignTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar paquete extra</DialogTitle>
            <DialogDescription>
              Vas a asignar un paquete de <strong>35 envíos</strong> a{" "}
              <strong>{assignTarget?.userName}</strong>. Esto carga{" "}
              <strong>$ {extraPackagePrice.toLocaleString("es-MX")}</strong> a su
              billetera y queda registrado en el reporte de solicitudes con tu
              autoría. No requiere solicitud previa del cliente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignTarget(null)}
              disabled={assigning}
            >
              Cancelar
            </Button>
            <Button
              onClick={submitAssign}
              disabled={assigning}
              className="bg-[#00B5E2] hover:bg-[#0096BD]"
              data-testid="button-confirm-assign-package"
            >
              {assigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Asignando...
                </>
              ) : (
                "Confirmar asignación"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}




