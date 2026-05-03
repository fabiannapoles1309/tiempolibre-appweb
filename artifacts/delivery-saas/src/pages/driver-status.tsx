﻿import { useGetMyDriver, useUpdateMyDriverStatus, DriverStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES: { value: DriverStatus; label: string; color: string }[] = [
  { value: DriverStatus.ACTIVO, label: "Activo", color: "bg-green-100 text-green-700 border-green-300" },
  { value: DriverStatus.EN_ENTREGA, label: "En entrega", color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: DriverStatus.EN_PAUSA, label: "En pausa", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: DriverStatus.INACTIVO, label: "Inactivo", color: "bg-gray-100 text-gray-700 border-gray-300" },
];

export function DriverStatusCard() {
  const { data: driver, isLoading } = useGetMyDriver();
  const update = useUpdateMyDriverStatus();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando tu estado...
        </CardContent>
      </Card>
    );
  }

  if (!driver) return null;

  const current = driver.status;

  const change = async (status: DriverStatus) => {
    try {
      await update.mutateAsync({ data: { status } });
      toast.success(`Estado actualizado: ${STATUSES.find((s) => s.value === status)?.label}`);
    } catch {
      toast.error("No se pudo actualizar el estado");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Mi estado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Cambialo según tu disponibilidad. Los admins ven tu estado en tiempo real.
        </div>
        <div className="grid grid-cols-2 gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s.value}
              variant={current === s.value ? "default" : "outline"}
              className={current === s.value ? "bg-[#00B5E2] hover:bg-[#0096BD]" : ""}
              onClick={() => change(s.value)}
              disabled={update.isPending}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground border-t pt-3">
          Efectivo a rendir: <span className="font-bold text-foreground">$ {driver.cashPending.toLocaleString("es-MX")}</span>
        </div>
      </CardContent>
    </Card>
  );
}



