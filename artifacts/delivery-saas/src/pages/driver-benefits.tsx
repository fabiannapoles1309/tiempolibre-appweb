import {
  useGetMyDriver,
  useGetMyDriverBenefits,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Gift,
  Stethoscope,
  Wrench,
  Fuel,
  Smartphone,
  Headphones,
  Loader2,
  Trophy,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  fuel: Fuel,
  wrench: Wrench,
  stethoscope: Stethoscope,
  smartphone: Smartphone,
  headphones: Headphones,
  gift: Gift,
};

function iconFor(key: string): LucideIcon {
  return ICON_MAP[key] ?? Gift;
}

export default function DriverBenefits() {
  const { data: driver } = useGetMyDriver();
  const { data, isLoading } = useGetMyDriverBenefits();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="w-7 h-7 text-[#00B5E2]" />
          Mis beneficios
        </h1>
        <p className="text-muted-foreground mt-1">
          Eres parte de TiempoLibre. Mientras más entregas completes, más
          beneficios desbloqueas.
        </p>
      </div>

      {driver && (
        <Card className="border-[#00B5E2]/30 bg-[#00B5E2]/5">
          <CardContent className="p-4 text-sm">
            Hola <strong>{driver.name}</strong>, tienes registrado el vehículo{" "}
            <strong>{driver.vehicle}</strong>
            {driver.licensePlate ? ` (placas ${driver.licensePlate})` : ""} en
            zonas{" "}
            <strong>{driver.zones.join(", ") || "sin asignar"}</strong>.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[#00B5E2]" />
            Tu progreso del mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Entregas este mes
                  </p>
                  <p className="text-3xl font-bold text-[#00B5E2]">
                    {data.deliveries}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Nivel actual
                  </p>
                  {data.currentLevel > 0 ? (
                    <p className="text-lg font-semibold flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-[#00B5E2]" />
                      Nivel {data.currentLevel}
                      {data.currentLevelName ? ` · ${data.currentLevelName}` : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                      Aún no alcanzas el primer nivel
                    </p>
                  )}
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Próximo nivel
                  </p>
                  {data.nextLevel != null ? (
                    <p className="text-lg font-semibold">
                      Nivel {data.nextLevel}
                      {data.nextLevelName ? ` · ${data.nextLevelName}` : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                      Has alcanzado el nivel máximo
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Progress
                  value={data.progressPct}
                  className="h-3"
                  data-testid="driver-progress-bar"
                />
                <p className="text-sm text-center font-medium">
                  {data.remainingForNext != null && data.remainingForNext > 0 ? (
                    <>
                      Te faltan{" "}
                      <span className="text-[#00B5E2] font-bold">
                        {data.remainingForNext} entregas
                      </span>{" "}
                      para desbloquear{" "}
                      <strong>
                        Nivel {data.nextLevel}
                        {data.nextLevelName ? ` · ${data.nextLevelName}` : ""}
                      </strong>
                    </>
                  ) : data.nextLevel == null ? (
                    <span className="text-[#00B5E2]">
                      ¡Felicidades! Has desbloqueado todos los niveles del mes.
                    </span>
                  ) : (
                    <span className="text-[#00B5E2]">
                      ¡Listo! Acabas de alcanzar este nivel.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#00B5E2]" />
            Beneficios desbloqueados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.benefits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tienes beneficios desbloqueados este mes. ¡Sigue entregando!
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {data.benefits.map((b) => {
                const Icon = iconFor(b.icon);
                const delivered = b.status === "ENTREGADO";
                return (
                  <div
                    key={b.benefitItemId}
                    className="flex items-start gap-3 border rounded-md p-3"
                    data-testid={`driver-benefit-${b.benefitItemId}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#00B5E2]/15 text-[#0096BD] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm">{b.name}</p>
                        <Badge
                          variant={delivered ? "secondary" : "outline"}
                          className={
                            delivered
                              ? "bg-emerald-500/15 text-emerald-700 border-0"
                              : "border-amber-500 text-amber-700"
                          }
                        >
                          {delivered ? "Entregado" : "Por reclamar"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Nivel {b.level}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



