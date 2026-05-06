import { useState } from "react";
import { useGetDeliveriesReport, useGetDriversReport, GetDeliveriesReportRange, ZoneName } from "@workspace/api-client-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { Trophy, TrendingUp, Users } from "lucide-react";

export default function Reports() {
  const [range, setRange] = useState<GetDeliveriesReportRange>("week");
  const [zone, setZone] = useState<string>("ALL");

  const { data: deliveriesReport, isLoading: loadingDeliveries } = useGetDeliveriesReport({ 
    range,
    ...(zone !== "ALL" ? { zone: zone as ZoneName } : {})
  });

  const { data: driversReport, isLoading: loadingDrivers } = useGetDriversReport({ range });

  const formatChartDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return range === 'day' ? format(d, 'HH:mm') : 
           range === 'month' ? format(d, 'dd MMM', { locale: es }) : 
           format(d, 'EEEE', { locale: es });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground mt-1">Análisis detallado de entregas y rendimiento de equipo.</p>
      </div>

      <Tabs defaultValue="entregas" className="space-y-6">
        <TabsList className="bg-card border w-full justify-start rounded-lg h-auto p-1">
          <TabsTrigger value="entregas" className="px-6 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md text-base">
            <TrendingUp className="h-4 w-4 mr-2" /> Entregas y Volúmen
          </TabsTrigger>
          <TabsTrigger value="repartidores" className="px-6 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md text-base">
            <Users className="h-4 w-4 mr-2" /> Rendimiento de Repartidores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entregas" className="space-y-6 m-0">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={range} onValueChange={(v: any) => setRange(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Ášltimas 24 horas</SelectItem>
                <SelectItem value="week">Ášltima semana</SelectItem>
                <SelectItem value="month">Ášltimo mes</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Zona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las zonas</SelectItem>
                {Object.values(ZoneName).map((z) => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Volumen vs Ingresos</CardTitle>
              <CardDescription>Comparativa de cantidad de pedidos entregados y facturación generada</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {loadingDeliveries ? (
                <Skeleton className="h-full w-full" />
              ) : !deliveriesReport || deliveriesReport.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">Sin datos en este periodo</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={deliveriesReport} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatChartDate} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      dy={10}
                    />
                    <YAxis 
                      yAxisId="left" 
                      orientation="left" 
                      stroke="hsl(var(--muted-foreground))"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      stroke="hsl(var(--muted-foreground))"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                      labelFormatter={formatChartDate}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar yAxisId="right" dataKey="revenue" name="Ingresos ($)" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="left" type="monotone" dataKey="count" name="Pedidos" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--card))', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repartidores" className="space-y-6 m-0">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={range} onValueChange={(v: any) => setRange(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Ášltimas 24 horas</SelectItem>
                <SelectItem value="week">Ášltima semana</SelectItem>
                <SelectItem value="month">Ášltimo mes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ranking de Repartidores</CardTitle>
              <CardDescription>Mejores repartidores por volumen de entregas exitosas</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingDrivers ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !driversReport || driversReport.length === 0 ? (
                <div className="p-16 text-center text-muted-foreground">Sin datos en este periodo</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">Rank</TableHead>
                      <TableHead>Repartidor</TableHead>
                      <TableHead>Zonas</TableHead>
                      <TableHead className="text-right">Entregas</TableHead>
                      <TableHead className="text-right">Recaudado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driversReport.map((driver, idx) => {
                      let rankStyle = "text-muted-foreground font-medium";
                      let bgStyle = "";
                      
                      if (idx === 0) {
                        rankStyle = "text-yellow-600 dark:text-yellow-400 font-bold";
                        bgStyle = "bg-yellow-50 dark:bg-yellow-900/10";
                      } else if (idx === 1) {
                        rankStyle = "text-slate-500 dark:text-slate-300 font-bold";
                        bgStyle = "bg-slate-50 dark:bg-slate-800/30";
                      } else if (idx === 2) {
                        rankStyle = "text-amber-700 dark:text-amber-600 font-bold";
                        bgStyle = "bg-amber-50 dark:bg-amber-900/10";
                      }

                      return (
                        <TableRow key={driver.driverId} className={bgStyle}>
                          <TableCell className="text-center">
                            {idx < 3 ? <Trophy className={`inline h-5 w-5 ${rankStyle}`} /> : <span className={rankStyle}>{idx + 1}</span>}
                          </TableCell>
                          <TableCell className="font-medium">
                            {driver.driverName}
                            {!driver.active && <Badge variant="outline" className="ml-2 text-[10px]">Inactivo</Badge>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {driver.zones.map(z => <Badge key={z} variant="secondary" className="text-[10px]">{z}</Badge>)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-lg">{driver.deliveries}</TableCell>
                          <TableCell className="text-right text-muted-foreground">${driver.revenue.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}



