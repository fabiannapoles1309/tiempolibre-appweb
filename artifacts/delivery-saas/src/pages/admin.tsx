import { useState } from "react";
import { useListOrders, useListDrivers, useAssignOrdersAuto, useAssignOrderManual, getListOrdersQueryKey, OrderStatus, ZoneName, type Order, type Driver } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Clock, DollarSign, Package, Zap, Loader2, Navigation, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface PendingOrderRowProps {
  order: Order;
  zoneDrivers: Driver[];
  onAssign: (orderId: number, driverId: number) => Promise<void>;
}

function PendingOrderRow({ order, zoneDrivers, onAssign }: PendingOrderRowProps) {
  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async () => {
    if (!selectedDriver) return;
    setIsAssigning(true);
    try {
      await onAssign(order.id, parseInt(selectedDriver));
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 hover:bg-muted/10 transition-colors flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
      <div className="space-y-3 flex-1 w-full">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <span className="font-mono font-bold text-lg">#{order.id}</span>
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">PENDIENTE</Badge>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: es })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex gap-2 items-start">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-0.5">Recogida</p>
              <p className="font-medium">{order.pickup}</p>
            </div>
          </div>
          <div className="flex gap-2 items-start">
            <Navigation className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-0.5">Entrega</p>
              <p className="font-medium">{order.delivery}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm mt-2 pt-2 border-t border-border/50">
          <span className="flex items-center gap-1 font-medium">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            {order.amount.toFixed(2)}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">Pago: {order.payment}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto mt-4 xl:mt-0 p-4 xl:p-0 bg-muted/20 xl:bg-transparent rounded-lg">
        {zoneDrivers.length > 0 ? (
          <>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Seleccionar repartidor..." />
              </SelectTrigger>
              <SelectContent>
                {zoneDrivers.map(d => (
                  <SelectItem key={d.id} value={d.id.toString()}>{d.name} ({d.vehicle})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssign}
              disabled={!selectedDriver || isAssigning}
              className="w-full sm:w-auto"
            >
              {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Asignar"}
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-destructive text-sm font-medium px-4 py-2 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4" />
            Sin repartidores disponibles en zona
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDispatch() {
  const queryClient = useQueryClient();
  
  const { data: pendingOrders, isLoading: loadingOrders } = useListOrders({ status: OrderStatus.PENDIENTE });
  const { data: drivers, isLoading: loadingDrivers } = useListDrivers();
  
  const assignAuto = useAssignOrdersAuto();
  const assignManual = useAssignOrderManual();

  const handleAutoAssign = async () => {
    try {
      const res = await assignAuto.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast.success(`Asignación completada: ${res.assigned} asignados, ${res.skipped} omitidos.`);
    } catch (error: any) {
      toast.error(error?.data?.error || "Error al asignar automáticamente");
    }
  };

  const handleManualAssign = async (orderId: number, driverId: number) => {
    try {
      await assignManual.mutateAsync({ id: orderId, data: { driverId } });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast.success("Envío asignado correctamente");
    } catch (error: any) {
      toast.error(error?.data?.error || "Error al asignar envío");
    }
  };

  if (loadingOrders || loadingDrivers) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-12 w-48 mb-8" />
        <div className="space-y-6">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const groupedOrders = pendingOrders?.reduce((acc, order) => {
    const key = order.zone ?? "sin_zona";
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {} as Record<string, typeof pendingOrders>) || {};

  const zones = Object.values(ZoneName);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Despacho</h1>
          <p className="text-muted-foreground mt-1">Asigna envíos pendientes a tus repartidores.</p>
        </div>
        <Button size="lg" onClick={handleAutoAssign} disabled={assignAuto.isPending} className="w-full md:w-auto shadow-md">
          {assignAuto.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
          Asignación automática
        </Button>
      </div>

      {!pendingOrders || pendingOrders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Sin envíos pendientes</h3>
            <p className="text-muted-foreground mt-2 max-w-md">Todos los envíos han sido asignados o no hay nuevos envíos por el momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {zones.map(zone => {
            const zoneOrders = groupedOrders[zone] || [];
            if (zoneOrders.length === 0) return null;
            
            const zoneDrivers = drivers?.filter(d => d.active && d.zones.includes(zone as ZoneName)) || [];

            return (
              <Card key={zone} className="overflow-hidden border-t-4 border-t-primary">
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="h-5 w-5 text-primary" />
                      <CardTitle className="text-xl">Zona {zone}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {zoneOrders.length} {zoneOrders.length === 1 ? 'envío' : 'envíos'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {zoneOrders.map(order => (
                      <PendingOrderRow
                        key={order.id}
                        order={order}
                        zoneDrivers={zoneDrivers}
                        onAssign={handleManualAssign}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
