import { useState } from "react";
import { Link } from "wouter";
import { useListOrders, OrderStatus, ZoneName, UserRole } from "@workspace/api-client-react";
import { useAuth, isAdmin } from "@/lib/auth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Eye, HandCoins } from "lucide-react";
import {
  CustomerPickupSettleActions,
  type PickupSettlementOrder,
} from "@/components/pickup-settlement";

const statusColors: Record<string, string> = {
  [OrderStatus.PENDIENTE]: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
  [OrderStatus.ASIGNADO]: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  [OrderStatus.EN_RUTA]: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  [OrderStatus.ENTREGADO]: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  [OrderStatus.CANCELADO]: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
};

export default function OrdersList() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");
  
  const { data: orders, isLoading } = useListOrders({
    ...(statusFilter !== "ALL" ? { status: statusFilter as OrderStatus } : {}),
    ...(zoneFilter !== "ALL" ? { zone: zoneFilter as ZoneName } : {}),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Envíos</h1>
          <p className="text-muted-foreground mt-1">Gestiona y da seguimiento a los envíos del sistema.</p>
        </div>
        {user?.role === UserRole.CLIENTE && (
          <Link href="/orders/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo envío
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <CardTitle>Listado de envíos</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  {Object.values(OrderStatus).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin(user) && (
                <Select value={zoneFilter} onValueChange={setZoneFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Zona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas las zonas</SelectItem>
                    {Object.values(ZoneName).map((z) => (
                      <SelectItem key={z} value={z}>Zona {z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PackageIcon className="mx-auto h-12 w-12 mb-4 text-muted/50" />
              <p>No se encontraron envíos con estos filtros.</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    {isAdmin(user) && <TableHead>Cliente</TableHead>}
                    <TableHead>Ruta</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell
                        className="font-medium font-mono"
                        data-testid={`text-order-folio-${order.id}`}
                      >
                        {order.folio ?? `#${order.id}`}
                      </TableCell>
                      {isAdmin(user) && <TableCell>{order.customerName}</TableCell>}
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span className="truncate max-w-[200px]" title={order.pickup}>Origen: {order.pickup}</span>
                          <span className="truncate max-w-[200px]" title={order.delivery}>Destino: {order.delivery}</span>
                        </div>
                      </TableCell>
                      <TableCell>{order.zone ? `Zona ${order.zone}` : <span className="text-muted-foreground italic">sin zona</span>}</TableCell>
                      <TableCell>${order.amount.toFixed(2)}</TableCell>
                      <TableCell>{format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[order.status]}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Cliente con liquidación al recoger pendiente:
                              botones inline (Confirmar / Disputar) sin abrir
                              detalle. */}
                          {user?.role === UserRole.CLIENTE &&
                            (order as any).pickupSettledAt &&
                            !(order as any).pickupSettlementConfirmedAt &&
                            !(order as any).pickupSettlementDisputedAt && (
                              <>
                                <span
                                  className="hidden md:inline-flex items-center gap-1 mr-1 text-[11px] font-medium text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded"
                                  title={`Liquidación pendiente: $${(order as any).pickupSettledAmount?.toFixed(2) ?? "?"}`}
                                  data-testid={`badge-settlement-pending-${order.id}`}
                                >
                                  <HandCoins className="h-3 w-3" />
                                  Liquidación
                                </span>
                                <CustomerPickupSettleActions
                                  order={order as unknown as PickupSettlementOrder}
                                  variant="inline"
                                />
                              </>
                            )}
                          <Link href={`/orders/${order.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PackageIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}
