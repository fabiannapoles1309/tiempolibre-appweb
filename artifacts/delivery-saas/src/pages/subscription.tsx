import {
  useGetMySubscription,
  useSubscribe,
  useRechargeSubscription,
  useGetMyCustomerProfile,
  SubscriptionTier,
  getGetMySubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Check, AlertTriangle, Loader2, Plus, MapPin } from "lucide-react";
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

const BLOCK_SIZE = 35;

function BlockOf35({
  remaining,
  monthly,
}: {
  remaining: number;
  monthly: number;
}) {
  const used = Math.max(0, monthly - remaining);
  // Bloque actual = los últimos `BLOCK_SIZE` envíos del cupo, o todos si total < 35.
  const blockTotal = Math.min(BLOCK_SIZE, monthly || BLOCK_SIZE);
  const blockRemaining = Math.min(remaining, blockTotal);
  const blockUsed = blockTotal - blockRemaining;
  const cells = Array.from({ length: blockTotal }, (_, i) => i < blockRemaining);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold">
          Bloque actual:{" "}
          <span className="text-[#0096BD]">
            {blockRemaining}/{blockTotal} restantes
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Total del periodo: {used}/{monthly} usados
        </div>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.min(blockTotal, 35)}, minmax(0, 1fr))` }}
        data-testid="block-35-grid"
      >
        {cells.map((isRemaining, i) => (
          <div
            key={i}
            className={`h-3 rounded-sm transition-colors ${
              isRemaining ? "bg-[#00B5E2]" : "bg-muted-foreground/20"
            }`}
            title={isRemaining ? "Disponible" : "Usado"}
          />
        ))}
      </div>
      {blockUsed > 0 && (
        <div className="text-xs text-muted-foreground">
          {blockUsed} {blockUsed === 1 ? "envío usado" : "envíos usados"} de este bloque.
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  const { data, isLoading } = useGetMySubscription();
  const { data: profile } = useGetMyCustomerProfile();
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
          Consulta tu plan activo y la cantidad de envíos disponibles.
        </p>
      </div>

      {profile && (
        <Card className="border-muted">
          <CardContent className="pt-6 grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Establecimiento</div>
              <div className="font-medium">{profile.businessName ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Zona asignada
              </div>
              <div
                className="font-medium"
                data-testid="value-assigned-zone"
              >
                {profile.clienteZone != null ? `Zona ${profile.clienteZone}` : "Sin asignar"}
              </div>
            </div>
            {profile.pickupAddress && (
              <div className="sm:col-span-2">
                <div className="text-xs text-muted-foreground">Dirección de recolección</div>
                <div className="font-medium">{profile.pickupAddress}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              ¡Atención! Te quedan{" "}
              <span className="font-bold">{sub.remainingDeliveries}</span> envíos. Solicita una
              recarga para no quedarte sin servicio.
            </div>
          )}

          <Card className="border-[#00B5E2]/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Plan actual: <span className="text-[#0096BD]">{sub.tier}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <BlockOf35
                remaining={sub.remainingDeliveries}
                monthly={sub.monthlyDeliveries}
              />

              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Cuota mensual</div>
                  <div className="text-xl font-bold">
                    $ {sub.monthlyPrice.toLocaleString("es-MX")}
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Envíos del periodo</div>
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
                  Periodo iniciado: {new Date(sub.periodStart).toLocaleDateString("es-MX")}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            Aún no tienes un plan activo. Elige uno para empezar a gestionar tus envíos.
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
                      $ {p.price.toLocaleString("es-MX")}
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
