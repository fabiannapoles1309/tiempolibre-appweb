import { useGetMyDriver } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Stethoscope, Shield, Wrench, Coffee, Loader2 } from "lucide-react";

const BENEFITS = [
  {
    icon: Stethoscope,
    title: "Atención médica",
    desc: "Cobertura básica de consultas y emergencias mientras estás trabajando con TiempoLibre.",
  },
  {
    icon: Shield,
    title: "Seguro contra accidentes",
    desc: "Cobertura ante siniestros viales durante tu jornada de reparto.",
  },
  {
    icon: Wrench,
    title: "Mantenimiento de moto",
    desc: "Descuentos en talleres asociados para mantener tu vehículo en condiciones.",
  },
  {
    icon: Coffee,
    title: "Espacios de descanso",
    desc: "Acceso a puntos de descanso con WiFi, baño y un café para recargar energías.",
  },
];

export default function DriverBenefits() {
  const { data: driver, isLoading } = useGetMyDriver();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="w-7 h-7 text-[#00B5E2]" />
          Mis beneficios
        </h1>
        <p className="text-muted-foreground mt-1">
          Sos parte de TiempoLibre. Estos beneficios están pensados para que estés tranquilo en la calle.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
        </div>
      ) : driver ? (
        <Card className="border-[#00B5E2]/30 bg-[#00B5E2]/5">
          <CardContent className="p-4 text-sm">
            Hola <strong>{driver.name}</strong>, llevás registrado el vehículo{" "}
            <strong>{driver.vehicle}</strong>
            {driver.licensePlate ? ` (patente ${driver.licensePlate})` : ""} en zonas{" "}
            <strong>{driver.zones.join(", ") || "sin asignar"}</strong>.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        {BENEFITS.map((b) => {
          const Icon = b.icon;
          return (
            <Card key={b.title}>
              <CardHeader className="flex-row items-center gap-3 pb-2">
                <div className="w-10 h-10 rounded-lg bg-[#00B5E2]/15 text-[#0096BD] flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <CardTitle className="text-base">{b.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{b.desc}</CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
