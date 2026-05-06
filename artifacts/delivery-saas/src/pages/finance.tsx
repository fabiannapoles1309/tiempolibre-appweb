import { useState } from "react";
import {
  useGetFinanceSummary,
  GetFinanceSummaryRange,
  useListTransactions,
  useGetCashReport,
  useGetB2BRevenue,
  useGetFinanceTodaySplit,
  useAdminListClientes,
  financeExportExcel,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { DollarSign, TrendingUp, TrendingDown, Activity, CreditCard, ArrowUpRight, ArrowDownRight, FileSpreadsheet, Loader2 } from "lucide-react";

const formatMoney = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

type ExportType = "deliveries" | "plans" | "accounting";
type ExportPeriod = "day" | "week" | "month" | "year";

const EXPORT_LABELS: Record<ExportType, string> = {
  deliveries: "Reporte por reparto",
  plans: "Reporte por planes",
  accounting: "Reporte contable",
};

// Mapeo determinístico color/etiqueta por método. Los 5 métodos soportados
// son EFECTIVO, TRANSFERENCIA, BILLETERA, TARJETA y CORTESIA. Si el backend
// devuelve otro valor (legacy/desconocido) cae a un color neutro.
const METHOD_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  BILLETERA: 'Billetera',
  TARJETA: 'Tarjeta',
  CORTESIA: 'Cortesía',
};
const METHOD_COLORS: Record<string, string> = {
  EFECTIVO: '#f97316',       // naranja
  TRANSFERENCIA: '#3b82f6',  // azul
  BILLETERA: '#10b981',      // verde
  TARJETA: '#8b5cf6',        // morado
  CORTESIA: '#a3a3a3',       // gris neutro
};
const METHOD_ORDER = ['EFECTIVO', 'TRANSFERENCIA', 'BILLETERA', 'TARJETA', 'CORTESIA'] as const;

function methodLabel(m: string): string {
  return METHOD_LABELS[m] ?? m;
}
function methodColor(m: string): string {
  return METHOD_COLORS[m] ?? '#d4d4d8';
}

export default function Finance() {
  const [range, setRange] = useState<GetFinanceSummaryRange>("week");
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("month");
  const [exportClienteId, setExportClienteId] = useState<string>("");
  const [downloading, setDownloading] = useState<ExportType | null>(null);

  const { data: summary, isLoading: loadingSummary } = useGetFinanceSummary({ range });
  const { data: transactions, isLoading: loadingTx } = useListTransactions();
  const { data: cashReport } = useGetCashReport();
  const { data: b2b } = useGetB2BRevenue();
  const { data: todaySplit } = useGetFinanceTodaySplit();
  const { data: clientes } = useAdminListClientes();

  const handleExport = async (type: ExportType) => {
    setDownloading(type);
    try {
      const blob = await financeExportExcel({
        type,
        period: exportPeriod,
        ...(exportClienteId ? { clienteId: Number(exportClienteId) } : {}),
      });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `tiempolibre_${type}_${exportPeriod}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success(`${EXPORT_LABELS[type]} descargado`);
    } catch (e: any) {
      toast.error(`No se pudo descargar el reporte: ${e?.message ?? "error"}`);
    } finally {
      setDownloading(null);
    }
  };

  const formatChartDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return range === 'day' ? format(d, 'HH:mm') : 
           range === 'month' ? format(d, 'dd MMM', { locale: es }) : 
           format(d, 'EEEE', { locale: es });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
          <p className="text-muted-foreground mt-1">Control de ingresos, gastos y rentabilidad general.</p>
        </div>
        <Select value={range} onValueChange={(v: any) => setRange(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Hoy</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-[#00B5E2]/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#00B5E2]" />
            Descargar reportes (Excel)
          </CardTitle>
          <CardDescription>
            Elige el periodo y, opcionalmente, el cliente. El archivo se descarga en formato XLSX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Periodo
              </label>
              <Select value={exportPeriod} onValueChange={(v: ExportPeriod) => setExportPeriod(v)}>
                <SelectTrigger data-testid="select-export-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="year">Año</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Cliente (opcional)
              </label>
              <Select
                value={exportClienteId || "ALL"}
                onValueChange={(v) => setExportClienteId(v === "ALL" ? "" : v)}
              >
                <SelectTrigger data-testid="select-export-cliente">
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los clientes</SelectItem>
                  {(clientes ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} {c.businessName ? `Â· ${c.businessName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["deliveries", "plans", "accounting"] as ExportType[]).map((t) => (
              <Button
                key={t}
                onClick={() => handleExport(t)}
                disabled={downloading !== null}
                className="bg-[#00B5E2] hover:bg-[#0096BD]"
                data-testid={`button-export-${t}`}
              >
                {downloading === t ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                {EXPORT_LABELS[t]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#00B5E2]/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos por Reparto (hoy)</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-[#00B5E2]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="value-reparto-today">
              {formatMoney(todaySplit?.repartoToday ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Envíos entregados hoy</p>
          </CardContent>
        </Card>
        <Card className="border-[#00B5E2]/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos por Planes (hoy)</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-[#00B5E2]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="value-planes-today">
              {formatMoney(todaySplit?.planesToday ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Suscripciones contratadas hoy</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-primary">Total hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-primary">
              {formatMoney(todaySplit?.total ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {!summary || loadingSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Totales</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatMoney(summary.income)}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Totales</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatMoney(summary.expenses)}</div>
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-primary">Ganancia Neta</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-extrabold ${summary.profit >= 0 ? 'text-primary' : 'text-red-500'}`}>
                {formatMoney(summary.profit)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Envíos liquidados</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{summary.ordersCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatMoney(summary.avgTicket)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Flujo de Caja</CardTitle>
            <CardDescription>Evolución de ingresos y egresos en el tiempo</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {loadingSummary ? <Skeleton className="h-full w-full" /> : summary?.timeline.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">No hay actividad</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary?.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={formatChartDate} axisLine={false} tickLine={false} dy={10} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip formatter={(val: number) => formatMoney(val)} labelFormatter={formatChartDate} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                  <Legend />
                  <Area type="monotone" dataKey="income" name="Ingresos" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expenses" name="Gastos" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métodos de Pago</CardTitle>
            <CardDescription>Distribución de ingresos por canal</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {(() => {
              if (loadingSummary) return <Skeleton className="h-full w-full" />;
              const raw = summary?.byMethod ?? [];
              // Ordenamos en el orden canónico y traducimos las claves a etiquetas
              // legibles. Cortesía siempre se muestra aunque su monto sea $0,
              // porque cuenta como servicio prestado.
              // Siempre mostramos los 5 métodos canónicos (Efectivo, Transferencia,
              // Billetera, Tarjeta, Cortesía) aunque alguno no tenga actividad,
              // para que la leyenda y los colores sean estables y para que la
              // Cortesía permanezca visible aun con $0 de ingreso.
              const data = METHOD_ORDER.map((m) => {
                const found = raw.find((r) => r.method === m);
                return {
                  method: m,
                  label: methodLabel(m),
                  total: found ? Number(found.total) : 0,
                  count: found ? found.count : 0,
                };
              });
              // Métodos legacy que no estén en METHOD_ORDER se anexan al final
              // (sólo si tuvieron actividad, para no contaminar la leyenda).
              for (const r of raw) {
                if (
                  !METHOD_ORDER.includes(r.method as typeof METHOD_ORDER[number]) &&
                  (Number(r.total) > 0 || r.count > 0)
                ) {
                  data.push({
                    method: r.method,
                    label: methodLabel(r.method),
                    total: Number(r.total),
                    count: r.count,
                  });
                }
              }
              const hasAnyActivity = data.some((d) => d.total > 0 || d.count > 0);
              if (!hasAnyActivity) {
                return (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Sin pagos registrados
                  </div>
                );
              }
              // Para el área del pie usamos `Math.max(total, 0)` para que las
              // cortesías ($0 ingreso) sigan apareciendo en la leyenda con un
              // área mínima y un color identificable.
              const pieData = data.map((d) => ({
                ...d,
                slice: d.total > 0 ? d.total : Math.max(1, d.count),
              }));
              return (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="slice"
                      nameKey="label"
                    >
                      {pieData.map((entry) => (
                        <Cell key={`cell-${entry.method}`} fill={methodColor(entry.method)} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(_v, _n, p: { payload?: { total: number; count: number; label: string } }) => {
                        const d = p?.payload;
                        if (!d) return ['', ''];
                        return [
                          `${formatMoney(d.total)} Â· ${d.count} servicio${d.count === 1 ? '' : 's'}`,
                          d.label,
                        ];
                      }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Efectivo en mano de repartidores</CardTitle>
            <CardDescription>
              Total a rendir: <span className="font-bold text-foreground">{formatMoney(cashReport?.totalCashPending ?? 0)}</span>
              {" Â· "}Cobrado en el período: <span className="font-bold text-foreground">{formatMoney(cashReport?.totalCashCollected ?? 0)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!cashReport || cashReport.drivers.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No hay efectivo pendiente de rendición.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repartidor</TableHead>
                    <TableHead className="text-right">A rendir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashReport.drivers.map((d) => (
                    <TableRow key={d.driverId}>
                      <TableCell>{d.driverName}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(Number(d.cashPending))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recaudación por suscripciones</CardTitle>
            <CardDescription>
              MRR activo:{" "}
              <span className="font-bold text-foreground">{formatMoney(b2b?.totalMrr ?? 0)}</span>{" "}
              Â· Ingresos del mes:{" "}
              <span className="font-bold text-foreground">{formatMoney(b2b?.totalRevenue ?? 0)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!b2b || b2b.clients.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Aún no hay clientes suscritos.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Envíos del mes</TableHead>
                    <TableHead className="text-right">Recaudación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {b2b.clients.map((e) => (
                    <TableRow key={e.customerId}>
                      <TableCell>{e.customerName}</TableCell>
                      <TableCell>
                        {e.subscriptionTier ? (
                          <Badge variant="secondary" className="text-xs">{e.subscriptionTier}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">â€”</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{e.ordersCount}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(Number(e.revenue))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transacciones Recientes</CardTitle>
          <CardDescription>Ášltimos movimientos financieros del sistema</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingTx ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No hay transacciones recientes.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(tx.createdAt), "dd MMM HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {tx.description}
                      {tx.orderId && <span className="ml-2 text-xs text-muted-foreground">Envío #{tx.orderId}</span>}
                    </TableCell>
                    <TableCell>
                      {tx.type === "INGRESO" ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20"><ArrowUpRight className="mr-1 h-3 w-3" /> INGRESO</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20"><ArrowDownRight className="mr-1 h-3 w-3" /> GASTO</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{tx.method}</Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${tx.type === 'INGRESO' ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.type === 'INGRESO' ? '+' : '-'}{formatMoney(tx.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




