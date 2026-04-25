import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateOrder, PaymentMethod, getListOrdersQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

// Cliente solo elige métodos de pago directos (sin Billetera).
const ALLOWED_PAYMENTS = [PaymentMethod.EFECTIVO, PaymentMethod.TRANSFERENCIA] as const;

const orderSchema = z.object({
  pickup: z.string().min(1, "La dirección de recolección es requerida"),
  delivery: z.string().min(1, "La dirección de entrega es requerida"),
  payment: z.enum([PaymentMethod.EFECTIVO, PaymentMethod.TRANSFERENCIA], {
    required_error: "Selecciona un método de pago",
  }),
  notes: z.string().optional(),
});

export default function NewOrder() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createMutation = useCreateOrder();

  const form = useForm<z.infer<typeof orderSchema>>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      pickup: "",
      delivery: "",
      notes: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof orderSchema>) => {
    try {
      // El admin asigna la zona y el monto. Cliente solo carga origen/destino + pago.
      await createMutation.mutateAsync({
        data: {
          pickup: data.pickup,
          delivery: data.delivery,
          payment: data.payment,
          notes: data.notes ?? null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      toast.success("Pedido creado exitosamente");
      setLocation("/orders");
    } catch (error: any) {
      toast.error(error.data?.error || "Error al crear el pedido");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Pedido</h1>
          <p className="text-muted-foreground mt-1">Ingresa los detalles para la recolección y entrega.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalles del Pedido</CardTitle>
          <CardDescription>El equipo de despacho asignará la zona y el repartidor según la dirección de entrega.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <FormField
                  control={form.control}
                  name="pickup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección de Recolección</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Av. Principal 123, Bodega A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delivery"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección de Entrega</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Calle Secundaria 456, Apto 2B" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pago</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Método de pago" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ALLOWED_PAYMENTS.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas adicionales (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Instrucciones especiales para el repartidor..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Link href="/orders">
                  <Button variant="outline" type="button">Cancelar</Button>
                </Link>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Crear Pedido
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
