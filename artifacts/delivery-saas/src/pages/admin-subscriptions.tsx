import { useListSubscriptions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2 } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  ACTIVA: "bg-green-100 text-green-700 border-green-300",
  CANCELADA: "bg-gray-100 text-gray-700 border-gray-300",
  VENCIDA: "bg-red-100 text-red-700 border-red-300",
};

export default function AdminSubscriptionsPage() {
  const { data: subs = [], isLoading } = useListSubscriptions();

  const totalMRR = subs
    .filter((s) => s.status === "ACTIVA")
    .reduce((acc, s) => acc + Number(s.monthlyPrice), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown className="w-7 h-7 text-[#00B5E2]" /> Suscripciones B2B
        </h1>
        <p className="text-muted-foreground mt-1">
          Plan contratado por cada cliente y consumo del período en curso.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Recurrente activo</CardTitle>
          <span className="text-2xl font-bold text-[#0096BD]">
            $ {totalMRR.toLocaleString("es-MX")}/mes
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
                    <th className="py-2 pr-4 text-right">Cuota</th>
                    <th className="py-2 pr-4 text-right">Envíos</th>
                    <th className="py-2 pr-4">Período</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="py-2 pr-4 font-medium">{s.userName}</td>
                      <td className="py-2 pr-4">{s.tier}</td>
                      <td className="py-2 pr-4 text-right">
                        $ {Number(s.monthlyPrice).toLocaleString("es-MX")}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {s.usedDeliveries} / {s.monthlyDeliveries}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {new Date(s.periodStart).toLocaleDateString("es-MX")}
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className={STATUS_COLOR[s.status] ?? ""}>
                          {s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
