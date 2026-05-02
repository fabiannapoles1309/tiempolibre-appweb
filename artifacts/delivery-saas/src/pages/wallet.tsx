import { useState } from "react";
import { useGetWallet, useListWalletTransactions, useTopUpWallet, useGetMySubscription, getGetMySubscriptionQueryKey, getGetWalletQueryKey, getListWalletTransactionsQueryKey, PaymentMethod } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Wallet, PlusCircle, ArrowUpRight, ArrowDownRight, RotateCcw, Loader2, PackagePlus, Clock, Truck } from "lucide-react";

const BLOCK_SIZE = 35;

function BlockOf35({ remaining, monthly }: { remaining: number; monthly: number }) {
  const used = Math.max(0, monthly - remaining);
  const blockTotal = Math.min(BLOCK_SIZE, monthly || BLOCK_SIZE);
  const blockRemaining = Math.min(remaining, blockTotal);
  const blockUsed = blockTotal - blockRemaining;
  const cells = Array.from({ length: blockTotal }, (_, i) => i < blockRemaining);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-semibold">
          Bloque actual: <span className="text-[#0096BD]">{blockRemaining}/{blockTotal} restantes</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Total del periodo: {used}/{monthly} usados
        </div>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.min(blockTotal, 35)}, minmax(0, 1fr))` }}
        data-testid="wallet-block-35-grid"
      >
        {cells.map((isRemaining, i) => (
          <div
            key={i}
            className={`h-3 rounded-sm transition-colors ${isRemaining ? "bg-[#00B5E2]" : "bg-muted-foreground/20"}`}
            title={isRemaining ? "Disponible" : "Usado"}
          />
        ))}
      </div>
      {blockUsed > 0 && (
        <div className="text-xs text-muted-foreground">
          {blockUsed} {blockUsed === 1 ? "envio usado" : "Envios usados"} de este bloque.
        </div>
      )}
    </div>
  );
}

const topUpSchema = z.object({
  amount: z.coerce.number().min(100, "El monto minimo es de $100"),
  method: z.nativeEnum(PaymentMethod).refine(m => m !== 'BILLETERA', "Metodo invalido para recarga"),
});

const formatMoney = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

export default function WalletPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // El CLIENTE solo visualiza su saldo: representa la cobranza acumulada
  // de los Envios pagados en EFECTIVO al momento de la entrega. No puede
  // recargar saldo ni gastarlo (no se usa como medio de pago).
  const isCliente = user?.role === "CLIENTE";

  const { data: wallet, isLoading: loadingWallet } = useGetWallet();
  const { data: transactions, isLoading: loadingTx } = useListWalletTransactions();
  const topUpMutation = useTopUpWallet();
  // Envios del periodo: visible solo para CLIENTE. Replicamos los counters
  // que ya existen en /subscription para que el cliente pueda consultarlos
  // junto con su saldo cobrado sin cambiar de pantalla.
  // Usamos la queryKey canonica (la que genera orval) para que cuando el
  // cliente crea un envio en /orders/new y se invalida ese key, esta tarjeta
  // ("Envios del periodo") refresque los contadores Solicitados/Restantes
  // automaticamente sin necesidad de recargar la pagina.
  const { data: subData, isLoading: loadingSub } = useGetMySubscription({
    query: {
      enabled: isCliente,
      queryKey: getGetMySubscriptionQueryKey(),
    },
  });
  const sub = subData?.subscription ?? null;

  const form = useForm<z.infer<typeof topUpSchema>>({
    resolver: zodResolver(topUpSchema),
    defaultValues: {
      amount: 0,
      method: PaymentMethod.TRANSFERENCIA,
    },
  });

  // Solicitudes de paquete: el cliente solo puede tener UNA pendiente a la vez.
  // El admin la aprueba (recarga +35 Envios) o la rechaza desde su panel.
  type PendingReq = { id: number; status: string; requestedAt: string } | null;
  const { data: activeReqData, refetch: refetchActiveReq } = useQuery<{ pending: PendingReq }>({
    enabled: isCliente,
    queryKey: ["my-package-request-active"],
    queryFn: async () => {
      const r = await apiFetch(`${import.meta.env.VITE_API_URL ?? ""}/api/me/package-requests/active`);
      if (!r.ok) return { pending: null };
      return r.json();
    },
    staleTime: 15_000,
  });
  const activeReq = activeReqData?.pending ?? null;
  const [requesting, setRequesting] = useState(false);
  const handleRequestPackage = async () => {
    setRequesting(true);
    try {
      const r = await apiFetch(`${import.meta.env.VITE_API_URL ?? ""}/api/me/package-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (r.status === 409) {
        toast.info("Ya tienes una solicitud pendiente.");
      } else if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast.error(err?.error || "No se pudo enviar la solicitud");
      } else {
        toast.success("Solicitud enviada. Tu administrador la revisara en breve.");
      }
      await refetchActiveReq();
    } catch {
      toast.error("Error al enviar la solicitud");
    } finally {
      setRequesting(false);
    }
  };

  const onSubmit = async (data: z.infer<typeof topUpSchema>) => {
    try {
      await topUpMutation.mutateAsync({ data });
      toast.success("Recarga registrada exitosamente");
      form.reset({ amount: 0, method: PaymentMethod.TRANSFERENCIA });
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListWalletTransactionsQueryKey() });
    } catch (error: any) {
      toast.error(error?.data?.error || "Error al recargar saldo");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mi Billetera</h1>
        <p className="text-muted-foreground mt-1">
          {isCliente
            ? "Saldo acumulado por las cobranzas en efectivo que tus repartidores realizan al entregar tus Envios."
            : "Gestiona el saldo prepago para agilizar tus Envios."}
        </p>
      </div>

      <div className={`grid grid-cols-1 ${isCliente ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-6`}>
        <Card className={`${isCliente ? "" : "lg:col-span-2"} relative overflow-hidden border-none shadow-lg`}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-orange-600 opacity-90"></div>
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <Wallet className="w-48 h-48 text-white rotate-12" />
          </div>
          <CardContent className="relative z-10 p-8 sm:p-12 flex flex-col justify-between h-full min-h-[250px]">
            <div>
              <p className="text-white/80 font-medium tracking-wide uppercase text-sm mb-2" data-testid="text-wallet-balance-label">
                {isCliente ? "Saldo cobrado" : "Saldo Disponible"}
              </p>
              {loadingWallet ? (
                <Skeleton className="h-16 w-64 bg-white/20" />
              ) : (
                <h2 className="text-5xl sm:text-7xl font-extrabold text-white tracking-tighter" data-testid="text-wallet-balance">
                  {formatMoney(wallet?.balance || 0)}
                </h2>
              )}
            </div>
            <div className="mt-8 text-white/80 text-sm flex items-center">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                Saldo actualizado al instante
              </span>
            </div>
          </CardContent>
        </Card>

        {isCliente && (
          <Card data-testid="card-envios-counters">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#00B5E2]" />
                Envios del periodo
              </CardTitle>
              <CardDescription>
                Resumen de tu paquete de Envios contratado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingSub ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
                </div>
              ) : !sub ? (
                <div className="text-sm text-muted-foreground">
                  Aun no tienes un plan activo. Visita "Mi suscripcion" para
                  contratar uno.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-muted-foreground">Totales</div>
                      <div
                        className="text-2xl font-bold"
                        data-testid="value-wallet-envios-totales"
                      >
                        {sub.monthlyDeliveries}
                      </div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-muted-foreground">Solicitados</div>
                      <div
                        className="text-2xl font-bold"
                        data-testid="value-wallet-envios-solicitados"
                      >
                        {sub.usedDeliveries}
                      </div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-muted-foreground">Restantes</div>
                      <div
                        className={`text-2xl font-bold ${sub.remainingDeliveries <= 5 ? "text-red-600" : "text-[#0096BD]"}`}
                        data-testid="value-wallet-envios-restantes"
                      >
                        {sub.remainingDeliveries}
                      </div>
                    </div>
                  </div>
                  <BlockOf35
                    remaining={sub.remainingDeliveries}
                    monthly={sub.monthlyDeliveries}
                  />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {isCliente && (
          <Card data-testid="card-request-package">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-[#00B5E2]" />
                Solicitar nuevo paquete de entregas
              </CardTitle>
              <CardDescription>
                Te quedaste sin Envios disponibles? Envia una solicitud y tu
                administrador la revisara para recargar tu paquete mensual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeReq ? (
                <div
                  className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                  data-testid="alert-package-request-pending"
                >
                  <Clock className="w-4 h-4" />
                  <div>
                    <p className="font-medium">Solicitud en revision</p>
                    <p className="text-xs text-amber-800">
                      Enviada el{" "}
                      {format(new Date(activeReq.requestedAt), "dd MMM yyyy, HH:mm", { locale: es })}
                      . Recibiras una confirmacion cuando tu administrador la
                      apruebe.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Al enviar la solicitud, notificaremos automaticamente al
                  administrador y al equipo de soporte.
                </p>
              )}
              <Button
                type="button"
                onClick={handleRequestPackage}
                disabled={requesting || !!activeReq}
                className="bg-[#00B5E2] hover:bg-[#0096BD] text-white"
                data-testid="button-request-package"
              >
                {requesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <PackagePlus className="w-4 h-4 mr-2" />
                    {activeReq ? "Solicitud enviada" : "Solicitar nuevo paquete"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {!isCliente && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" /> Recargar Saldo
            </CardTitle>
            <CardDescription>Agrega fondos mediante transferencia o efectivo en sucursal.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto a recargar (MXN)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                          <Input type="number" placeholder="5000" className="pl-8 text-lg font-medium" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metodo de pago</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un Metodo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={PaymentMethod.TRANSFERENCIA}>Transferencia Bancaria</SelectItem>
                          <SelectItem value={PaymentMethod.EFECTIVO}>Efectivo en Sucursal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full font-bold text-lg h-12" disabled={topUpMutation.isPending}>
                  {topUpMutation.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : "Confirmar Recarga"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos de Billetera</CardTitle>
          <CardDescription>Historial de recargas y pagos de Envios</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingTx ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Wallet className="mx-auto h-12 w-12 opacity-20 mb-4" />
              Aun no tienes movimientos en tu billetera.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  let badgeVariant = "outline";
                  let badgeClass = "";
                  let Icon = ArrowUpRight;
                  let sign = "";
                  let colorClass = "";

                  if (tx.type === "TOPUP") {
                    badgeClass = "bg-green-500/10 text-green-600 border-green-500/20";
                    sign = "+";
                    colorClass = "text-green-500";
                  } else if (tx.type === "PAGO") {
                    badgeClass = "bg-red-500/10 text-red-600 border-red-500/20";
                    Icon = ArrowDownRight;
                    sign = "-";
                    colorClass = "text-red-500";
                  } else if (tx.type === "REEMBOLSO") {
                    badgeClass = "bg-blue-500/10 text-blue-600 border-blue-500/20";
                    Icon = RotateCcw;
                    sign = "+";
                    colorClass = "text-blue-500";
                  }

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(tx.createdAt), "dd MMM, HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium">{tx.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badgeClass}>
                          <Icon className="mr-1 h-3 w-3" /> {tx.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-bold ${colorClass}`}>
                        {sign}{formatMoney(tx.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

