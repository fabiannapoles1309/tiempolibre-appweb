import { useGetDashboard, OrderStatus, UserRole } from "@workspace/api-client-react";
import { useAuth, isAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, Truck, CheckCircle2, DollarSign, Clock, Users, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { Link } from "wouter";

const statusColors: Record<string, string> = {
  [OrderStatus.PENDIENTE]: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  [OrderStatus.ASIGNADO]: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  [OrderStatus.EN_RUTA]: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  [OrderStatus.ENTREGADO]: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  [OrderStatus.CANCELADO]: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
};

const CHART_COLORS = ['#00B5E2', '#0B1E2D', '#10b981', '#f59e0b', '#ef4444'];

const ARS = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export default function Dashboard() {
  const { user } = useAuth();
  const { data: dashboardData, isLoading } = useGetDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboardData) return null;

  const { kpis, ordersByStatus, ordersByZone, recentOrders } = dashboardData;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wider text-primary uppercase">{getGreeting()}, {user?.name?.split(' ')[0]}</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mt-1">
            Panel de Control de Reparto
          </h1>
          <p className="text-muted-foreground mt-2">Resumen en tiempo real de tu operación.</p>
        </div>
        {user?.role === UserRole.CLIENTE && (
          <Link href="/orders/new">
            <Button size="lg" className="h-11 text-base font-semibold shadow-sm">
              <Plus className="w-5 h-5 mr-2" />
              Crear nuevo envío
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Envíos de hoy</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.todayOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.pendingOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Ruta</CardTitle>
            <Truck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.inRouteOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.deliveredToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ARS.format(kpis.todayRevenue)}</div>
          </CardContent>
        </Card>
        {isAdmin(user) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Repartidores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.activeDrivers}</div>
              <p className="text-xs text-muted-foreground">activos hoy</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className={`grid grid-cols-1 ${isAdmin(user) ? "lg:grid-cols-2" : ""} gap-6`}>
        <Card>
          <CardHeader>
            <CardTitle>Envíos por estado</CardTitle>
            <CardDescription>Distribución actual de órdenes</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {ordersByStatus.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="status"
                  >
                    {ordersByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {isAdmin(user) && (
          <Card>
            <CardHeader>
              <CardTitle>Envíos por zona</CardTitle>
              <CardDescription>Volumen de entregas por sector</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {ordersByZone.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ordersByZone} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="zone" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Envíos recientes</CardTitle>
          <CardDescription>Últimas 5 órdenes registradas en el sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentOrders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No hay envíos recientes.</div>
            ) : (
              recentOrders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="space-y-1">
                      <div className="font-medium">
                        Envío #{order.id} • <span className="text-muted-foreground">{order.customerName}</span>
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        De: {order.pickup} → Para: {order.delivery}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="hidden sm:block text-muted-foreground">
                        {format(new Date(order.createdAt), "dd MMM, HH:mm", { locale: es })}
                      </div>
                      <Badge variant="outline" className={statusColors[order.status]}>
                        {order.status}
                      </Badge>
                      <div className="font-medium text-right w-24">
                        {ARS.format(order.amount)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
