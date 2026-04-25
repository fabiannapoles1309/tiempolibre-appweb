import {
  useGetMySubscription,
  useSubscribe,
  SubscriptionTier,
  getGetMySubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Check, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PLANS = [
  {
    tier: SubscriptionTier.ESTANDAR,
    name: "Estándar",
    price: 15000,
    deliveries: 35,
    perks: [
      "35 envíos mensuales incluidos",
      "Soporte por email",
      "Reportes básicos",
    ],
    highlight: false,
  },
  {
    tier: SubscriptionTier.OPTIMO,
    name: "Óptimo",
    price: 25000,
    deliveries: 70,
    perks: [
      "70 envíos mensuales incluidos",
      "Soporte prioritario",
      "Reportes avanzados",
      "Asignación con prioridad",
    ],
    highlight: true,
  },
];

export default function SubscriptionPage() {
  const { data, isLoading } = useGetMySubscription();
  const subscribe = useSubscribe();
  const qc = useQueryClient();
  const sub = data?.subscription ?? null;

  const handleSubscribe = async (tier: SubscriptionTier) => {
    try {
      await subscribe.mutateAsync({ data: { tier } });
      toast.success("Suscripción activada");
      qc.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() });
    } catch {
      toast.error("No se pudo procesar la suscripción");
    }
  };

  const lowRemaining = sub != null && sub.remainingDeliveries < 5;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="w-7 h-7 text-[#00B5E2]" /> Mi suscripción
        </h1>
        <p className="text-muted-foreground mt-1">
          Elegí el plan que se ajusta al volumen de tu negocio.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando tu plan...
        </div>
      ) : sub ? (
        <Card className="border-[#00B5E2]/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Plan actual: <span className="text-[#0096BD]">{sub.tier}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Cuota mensual</div>
                <div className="text-xl font-bold">
                  $ {sub.monthlyPrice.toLocaleString("es-AR")}
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Envíos usados</div>
                <div className="text-xl font-bold">
                  {sub.usedDeliveries} / {sub.monthlyDeliveries}
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Restantes</div>
                <div className={`text-xl font-bold ${lowRemaining ? "text-red-600" : ""}`}>
                  {sub.remainingDeliveries}
                </div>
              </div>
            </div>
            {lowRemaining ? (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                <AlertTriangle className="w-4 h-4" />
                Te quedan menos de 5 envíos. Considerá renovar o cambiar de plan.
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Período iniciado: {new Date(sub.periodStart).toLocaleDateString("es-AR")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="text-sm text-muted-foreground">
          Aún no tenés un plan activo. Elegí uno para empezar a gestionar tus envíos.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {PLANS.map((p) => {
          const isCurrent = sub?.tier === p.tier;
          return (
            <Card
              key={p.tier}
              className={p.highlight ? "border-[#00B5E2] shadow-md" : ""}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{p.name}</span>
                  {p.highlight ? (
                    <span className="text-xs bg-[#00B5E2] text-white px-2 py-0.5 rounded">
                      Recomendado
                    </span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-bold">
                    $ {p.price.toLocaleString("es-AR")}
                    <span className="text-sm font-normal text-muted-foreground"> /mes</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {p.deliveries} envíos incluidos
                  </div>
                </div>
                <ul className="space-y-2 text-sm">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#00B5E2] mt-0.5 flex-shrink-0" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full bg-[#00B5E2] hover:bg-[#0096BD]"
                  onClick={() => handleSubscribe(p.tier)}
                  disabled={subscribe.isPending || isCurrent}
                >
                  {isCurrent
                    ? "Plan actual"
                    : subscribe.isPending
                      ? "Procesando..."
                      : sub
                        ? "Cambiar a este plan"
                        : "Suscribirme"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
