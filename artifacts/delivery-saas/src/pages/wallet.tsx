import { useState } from "react";
import { useGetWallet, useListWalletTransactions, useTopUpWallet, getGetWalletQueryKey, getListWalletTransactionsQueryKey, PaymentMethod } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Wallet, PlusCircle, ArrowUpRight, ArrowDownRight, RotateCcw, Loader2 } from "lucide-react";

const topUpSchema = z.object({
  amount: z.coerce.number().min(100, "El monto mínimo es de $100"),
  method: z.nativeEnum(PaymentMethod).refine(m => m !== 'BILLETERA', "Método inválido para recarga"),
});

const formatMoney = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

export default function WalletPage() {
  const queryClient = useQueryClient();

  const { data: wallet, isLoading: loadingWallet } = useGetWallet();
  const { data: transactions, isLoading: loadingTx } = useListWalletTransactions();
  const topUpMutation = useTopUpWallet();

  const form = useForm<z.infer<typeof topUpSchema>>({
    resolver: zodResolver(topUpSchema),
    defaultValues: {
      amount: 0,
      method: PaymentMethod.TRANSFERENCIA,
    },
  });

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
        <p className="text-muted-foreground mt-1">Gestioná tu saldo prepago para agilizar tus envíos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 relative overflow-hidden border-none shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-orange-600 opacity-90"></div>
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <Wallet className="w-48 h-48 text-white rotate-12" />
          </div>
          <CardContent className="relative z-10 p-8 sm:p-12 flex flex-col justify-between h-full min-h-[250px]">
            <div>
              <p className="text-white/80 font-medium tracking-wide uppercase text-sm mb-2">Saldo Disponible</p>
              {loadingWallet ? (
                <Skeleton className="h-16 w-64 bg-white/20" />
              ) : (
                <h2 className="text-5xl sm:text-7xl font-extrabold text-white tracking-tighter">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" /> Recargar Saldo
            </CardTitle>
            <CardDescription>Añadí fondos mediante transferencia o efectivo en sucursal.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto a recargar (ARS)</FormLabel>
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
                      <FormLabel>Método de pago</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccioná un método" />
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos de Billetera</CardTitle>
          <CardDescription>Historial de recargas y pagos de envíos</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingTx ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Wallet className="mx-auto h-12 w-12 opacity-20 mb-4" />
              Aún no tienes movimientos en tu billetera.
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
