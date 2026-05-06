import { useState } from "react";
import { useDriverEarnings, EarningsRange } from "@/hooks/useDriverEarnings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Package, DollarSign, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const RANGE_OPTIONS: { label: string; value: EarningsRange }[] = [
  { label: "Esta semana", value: "week" },
  { label: "Este mes", value: "month" },
  { label: "Este año", value: "year" },
];

export default function DriverEarnings() {
  const [range, setRange] = useState<EarningsRange>("week");
  const { data, isLoading, error } = useDriverEarnings(range);
  const formatDate = (d: string) => { try { return format(parseISO(d), range === "year" ? "MMM" : "dd/MM", { locale: es }); } catch { return d; } };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wider text-primary uppercase">Mi cuenta</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mt-1">Mis Ganancias</h1>
          <p className="text-muted-foreground mt-2">Resumen de ingresos por envios entregados.</p>
        </div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setRange(opt.value)}
              className={["px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                range === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted"].join(" ")}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive text-sm">{error}</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total ganado</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{MXN.format(data.total)}</div>
                <p className="text-xs text-muted-foreground mt-1">{RANGE_OPTIONS.find((o) => o.value === range)?.label}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Envios entregados</CardTitle>
                <Package className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.totalDeliveries}</div>
                <p className="text-xs text-muted-foreground mt-1">entregas completadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Promedio por envio</CardTitle>
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.totalDeliveries > 0 ? MXN.format(Math.round(data.total / data.totalDeliveries)) : MXN.format(0)}</div>
                <p className="text-xs text-muted-foreground mt-1">ganancia promedio</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-muted-foreground" />Ganancias por dia</CardTitle>
              <CardDescription>Ingresos acumulados por envios ENTREGADO</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {data.days.every((d) => d.revenue === 0) ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">Sin entregas en este periodo</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.days} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <RechartsTooltip cursor={{ fill: "transparent" }}
                      formatter={(value: number, _n: string, props: { payload: { count: number } }) => [MXN.format(value), `${props.payload.count} envios`]}
                      labelFormatter={(l: string) => formatDate(l)} />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={28}>
                      {data.days.map((entry, i) => <Cell key={i} fill={entry.revenue > 0 ? "#00B5E2" : "#00B5E233"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Detalle por dia</CardTitle><CardDescription>Envios y ganancias desglosados</CardDescription></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.days.filter((d) => d.count > 0).sort((a, b) => b.date.localeCompare(a.date)).map((day) => (
                  <div key={day.date} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="font-medium text-sm">{format(parseISO(day.date), "EEEE dd 'de' MMMM", { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="text-xs">{day.count} envio{day.count !== 1 ? "s" : ""}</Badge>
                      <span className="font-bold text-primary w-24 text-right">{MXN.format(day.revenue)}</span>
                    </div>
                  </div>
                ))}
                {data.days.filter((d) => d.count > 0).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">No hay entregas en este periodo.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
