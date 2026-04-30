import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Truck, BellOff } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL ?? "";

export default function DriverStatusToggle() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["driver-status"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/driver/status`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Error al obtener estado");
      return r.json() as Promise<{ active: boolean }>;
    },
  });

  const mutation = useMutation({
    mutationFn: async (active: boolean) => {
      const r = await fetch(`${API}/api/driver/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!r.ok) throw new Error("Error al actualizar estado");
      return r.json();
    },
    onSuccess: (_, active) => {
      qc.invalidateQueries({ queryKey: ["driver-status"] });
      toast.success(
        active
          ? "✅ Ahora estás activo — puedes recibir pedidos"
          : "⏸ Ahora estás inactivo — no recibirás pedidos"
      );
    },
    onError: () => toast.error("No se pudo actualizar el estado"),
  });

  const active = data?.active ?? true;

  return (
    <Card className="border-2 border-[#00B5E2]/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Truck className="w-5 h-5 text-[#00B5E2]" />
          Estado de disponibilidad
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">
              {active
                ? "Estás disponible para recibir pedidos"
                : "No recibirás nuevos pedidos"}
            </span>
            {active ? (
              <Badge className="w-fit bg-green-600 hover:bg-green-600 text-white">
                Activo
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="w-fit flex items-center gap-1"
              >
                <BellOff className="w-3 h-3" /> Inactivo
              </Badge>
            )}
          </div>

          {isLoading || mutation.isPending ? (
            <Loader2 className="w-6 h-6 animate-spin text-[#00B5E2]" />
          ) : (
            <Switch
              checked={active}
              onCheckedChange={(val) => mutation.mutate(val)}
              className="data-[state=checked]:bg-green-600 scale-125"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
