import {
  useGetMySubscription,
  useSubscribe,
  useRechargeSubscription,
  SubscriptionTier,
  getGetMySubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Check, AlertTriangle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

const PLANS = [
  {
    tier: SubscriptionTier.ESTANDAR,
    name: "Estándar",
    price: 15000,
    deliveries: 35,
    perks: ["35 envíos mensuales incluidos", "Soporte por email", "Reportes básicos"],
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
  const recharge = useRechargeSubscription();
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

  const handleRecharge = async () => {
    try {
      await recharge.mutateAsync();
      toast.success("Recarga aplicada: +35 envíos");
      qc.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() });
    } catch {
      toast.error("No se pudo procesar la recarga");
    }
  };

  const lowRemaining = sub != null && sub.remainingDeliveries <= 5;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="w-7 h-7 text-[#00B5E2]" /> Mi suscripción
        </h1>
        <p className="text-muted-foreground mt-1">
          Consultá tu plan activo y la cantidad de envíos disponibles.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando tu plan...
        </div>
      ) : sub ? (
        <>
          {lowRemaining && (
            <div
              className="flex items-center gap-3 text-sm text-red-700 bg-red-50 border border-red-300 rounded-md p-4 font-medium"
              data-testid="alert-low-remaining"
            >
              <AlertTriangle className="w-5 h-5" />
              ¡Atención! Te quedan <span className="font-bold">{sub.remainingDeliveries}</span> envíos.
              Solicitá una recarga para no quedarte sin servicio.
            </div>
          )}

          <Card className="border-[#00B5E2]/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Plan actual: <span className="text-[#0096BD]">{sub.tier}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <div
                    className={`text-xl font-bold ${lowRemaining ? "text-red-600" : ""}`}
                    data-testid="value-remaining"
                  >
                    {sub.remainingDeliveries}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="bg-[#00B5E2] hover:bg-[#0096BD]"
                  onClick={handleRecharge}
                  disabled={recharge.isPending}
                  data-testid="button-recharge"
                >
                  {recharge.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Solicitar recarga (+35 envíos)
                </Button>
                <p className="text-xs text-muted-foreground">
                  Período iniciado: {new Date(sub.periodStart).toLocaleDateString("es-AR")}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            Aún no tenés un plan activo. Elegí uno para empezar a gestionar tus envíos.
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {PLANS.map((p) => (
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
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        /mes
                      </span>
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
                    disabled={subscribe.isPending}
                  >
                    {subscribe.isPending ? "Procesando..." : "Suscribirme"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
