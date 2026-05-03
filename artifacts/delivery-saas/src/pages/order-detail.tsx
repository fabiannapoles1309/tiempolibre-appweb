﻿import { useParams } from "wouter";
import { useGetOrder, getGetOrderQueryKey, useUpdateOrder, useAssignOrderManual, useListDrivers, getListDriversQueryKey, OrderStatus, UserRole, getListOrdersQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useAuth, isAdmin } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Map, Package, Clock, DollarSign, User, Truck, Loader2, Phone } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import {
  CustomerPickupSettleActions,
  DriverPickupSettleButton,
  type PickupSettlementOrder,
} from "@/components/pickup-settlement";

const statusColors: Record<string, string> = {
  [OrderStatus.PENDIENTE]: "bg-yellow-100 text-yellow-800 border-yellow-200",
  [OrderStatus.ASIGNADO]: "bg-blue-100 text-blue-800 border-blue-200",
  [OrderStatus.EN_RUTA]: "bg-purple-100 text-purple-800 border-purple-200",
  [OrderStatus.ENTREGADO]: "bg-green-100 text-green-800 border-green-200",
  [OrderStatus.CANCELADO]: "bg-red-100 text-red-800 border-red-200",
};

export default function OrderDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  // Polling para que el cliente vea cambios de estado del repartidor casi en vivo.
  const { data: order, isLoading: loadingOrder } = useGetOrder(id, {
    query: {
      enabled: !!id,
      queryKey: getGetOrderQueryKey(id),
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
    },
  });

  const { data: drivers, isLoading: loadingDrivers } = useListDrivers({
    query: { enabled: isAdmin(user), queryKey: getListDriversQueryKey() }
  });

  const updateMutation = useUpdateOrder();
  const assignMutation = useAssignOrderManual();

  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      await updateMutation.mutateAsync({ id, data: { status: newStatus } });
      queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      toast.success("Estado actualizado");
    } catch (e: any) {
      toast.error(e.data?.error || "Error al actualizar estado");
    }
  };

  const handleAssign = async () => {
    if (!selectedDriverId) return;
    try {
      await assignMutation.mutateAsync({ id, data: { driverId: Number(selectedDriverId) } });
      queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast.success("Repartidor asignado");
    } catch (e: any) {
      toast.error(e.data?.error || "Error al asignar repartidor");
    }
  };

  if (loadingOrder) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-2" />
          <Skeleton className="h-64 col-span-1" />
        </div>
      </div>
    );
  }

  if (!order) return <div>EnvÃ­o no encontrado</div>;

  const validDrivers = drivers?.filter(d => d.active && (order.zone ? d.zones.includes(order.zone) : true)) || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">EnvÃ­o #{order.id}</h1>
              <Badge variant="outline" className={statusColors[order.status]}>
                {order.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Creado el {format(new Date(order.createdAt), "dd 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
            </p>
          </div>
        </div>

        {isAdmin(user) && (
          <Select onValueChange={(v) => handleStatusChange(v as OrderStatus)} value={order.status}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Cambiar estado" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(OrderStatus).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {user?.role === UserRole.DRIVER && (
          <div className="flex flex-wrap gap-2 items-center justify-end">
             {order.status === OrderStatus.ASIGNADO && (
               <Button
                 size="lg"
                 className="bg-[#00B5E2] hover:bg-[#0096BD]"
                 onClick={() => handleStatusChange(OrderStatus.EN_RUTA)}
                 data-testid="button-recoleccion"
               >
                 <Truck className="w-4 h-4 mr-2" /> RecolecciÃ³n
               </Button>
             )}
             {/* LiquidaciÃ³n al recoger: visible mientras el envÃ­o estÃ¡
                  ASIGNADO o EN_RUTA. Nada que ver con el COD del destinatario. */}
             {(order.status === OrderStatus.ASIGNADO ||
               order.status === OrderStatus.EN_RUTA) && (
               <DriverPickupSettleButton
                 order={order as unknown as PickupSettlementOrder}
               />
             )}
             {order.status === OrderStatus.EN_RUTA && (
               <Button
                 size="lg"
                 className="bg-green-600 hover:bg-green-700"
                 onClick={() => handleStatusChange(OrderStatus.ENTREGADO)}
                 data-testid="button-entregado"
               >
                 Entregado
               </Button>
             )}
          </div>
        )}
      </div>

      {/* Bloque del cliente: confirmar / disputar la liquidaciÃ³n al recoger.
           Aparece tanto en estado pendiente como en estados terminales
           (confirmada / disputada) para mostrar la trazabilidad. */}
      {user?.role === UserRole.CLIENTE &&
        (order as any).pickupSettledAt && (
          <CustomerPickupSettleActions
            order={order as unknown as PickupSettlementOrder}
          />
        )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalles de Ruta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-muted p-3 rounded-full mt-1">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">RecolecciÃ³n</h4>
                  <p className="text-foreground">{order.pickup}</p>
                </div>
              </div>
              
              <div className="ml-5 border-l-2 border-dashed border-border h-8"></div>
              
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full mt-1">
                  <Map className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Entrega</h4>
                  <p className="text-foreground">{order.delivery}</p>
                  <p className="text-sm text-muted-foreground mt-1">Zona: {order.zone}</p>
                  {order.recipientPhone && (
                    <p className="text-sm mt-2 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-[#00B5E2]" />
                      <span className="font-medium" data-testid="value-recipient-phone">
                        {order.recipientPhone}
                      </span>
                      <span className="text-muted-foreground text-xs">(destinatario)</span>
                    </p>
                  )}
                </div>
              </div>

              {order.payment === "EFECTIVO" && (order.cashAmount != null || order.cashChange != null) && (
                <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
                  {order.cashAmount != null && (
                    <div>
                      <p className="text-muted-foreground">Cobrar</p>
                      <p className="font-bold text-base">$ {Number(order.cashAmount).toLocaleString("es-MX")}</p>
                    </div>
                  )}
                  {order.cashChange != null && (
                    <div>
                      <p className="text-muted-foreground">Vuelto a entregar</p>
                      <p className="font-bold text-base">$ {Number(order.cashChange).toLocaleString("es-MX")}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notas del envÃ­o</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>InformaciÃ³n General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Cliente</p>
                  <p className="text-sm text-muted-foreground">{order.customerName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Monto y Pago</p>
                  <p className="text-sm text-muted-foreground">${order.amount.toFixed(2)} - {order.payment}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Ãšltima actualizaciÃ³n</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(order.updatedAt), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Repartidor Asignado</CardTitle>
            </CardHeader>
            <CardContent>
              {order.driverId ? (
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{order.driverName}</p>
                    <p className="text-sm text-muted-foreground">ID: {order.driverId}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Sin asignar</p>
                  
                  {isAdmin(user) && order.status === OrderStatus.PENDIENTE && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <p className="text-sm font-medium">AsignaciÃ³n manual</p>
                      {loadingDrivers ? (
                        <Skeleton className="h-10 w-full" />
                      ) : (
                        <div className="flex gap-2">
                          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                            <SelectContent>
                              {validDrivers.map(d => (
                                <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                              ))}
                              {validDrivers.length === 0 && (
                                <SelectItem value="none" disabled>No hay activos en la zona</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Button onClick={handleAssign} disabled={!selectedDriverId || assignMutation.isPending}>
                            {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Asignar"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


