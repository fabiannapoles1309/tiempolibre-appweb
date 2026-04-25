import { useGetDriverRanking, useGetMyDriver } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Loader2 } from "lucide-react";

export default function DriverRankingPage() {
  const { data: ranking = [], isLoading } = useGetDriverRanking();
  const { data: me } = useGetMyDriver();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-7 h-7 text-[#00B5E2]" /> Ranking de repartidores
        </h1>
        <p className="text-muted-foreground mt-1">
          Top performers según entregas confirmadas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Posiciones</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando ranking...
            </div>
          ) : ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay datos suficientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-4 w-16">#</th>
                    <th className="py-2 pr-4">Repartidor</th>
                    <th className="py-2 pr-4 text-right">Entregas</th>
                    <th className="py-2 text-right">Recaudación</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => {
                    const isMe = me && r.driverId === me.id;
                    return (
                      <tr
                        key={r.driverId}
                        className={`border-b ${isMe ? "bg-[#00B5E2]/10 font-semibold" : ""}`}
                      >
                        <td className="py-2 pr-4">
                          {r.rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-400 text-white">
                              1
                            </span>
                          ) : r.rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-white">
                              2
                            </span>
                          ) : r.rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700 text-white">
                              3
                            </span>
                          ) : (
                            <span className="text-muted-foreground">#{r.rank}</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {r.driverName}
                          {isMe ? <span className="ml-2 text-xs text-[#0096BD]">(vos)</span> : null}
                        </td>
                        <td className="py-2 pr-4 text-right">{r.deliveries}</td>
                        <td className="py-2 text-right">$ {Number(r.revenue).toLocaleString("es-AR")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
