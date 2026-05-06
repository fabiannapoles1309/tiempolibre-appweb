import { useEffect } from "react";
import {
  useGetPricingSettings,
  useUpdatePricingSettings,
  getGetPricingSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  estandarPrice: z.coerce.number().min(0, "Debe ser >= 0"),
  optimoPrice: z.coerce.number().min(0, "Debe ser >= 0"),
  extraPackagePrice: z.coerce.number().min(0, "Debe ser >= 0"),
});

type FormValues = z.infer<typeof schema>;

export default function AdminPricingSettingsPage() {
  const qc = useQueryClient();
  const { data: pricing, isLoading } = useGetPricingSettings();
  const updateMutation = useUpdatePricingSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { estandarPrice: 0, optimoPrice: 0, extraPackagePrice: 0 },
  });

  // Cuando llega la respuesta del backend, hidratamos el formulario.
  useEffect(() => {
    if (pricing) {
      form.reset({
        estandarPrice: pricing.estandarPrice,
        optimoPrice: pricing.optimoPrice,
        extraPackagePrice: pricing.extraPackagePrice,
      });
    }
  }, [pricing, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      await updateMutation.mutateAsync({ data });
      toast.success("Precios actualizados correctamente");
      qc.invalidateQueries({ queryKey: getGetPricingSettingsQueryKey() });
    } catch (e: any) {
      toast.error(e?.data?.error || "No se pudo guardar el cambio");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="w-7 h-7 text-[#00B5E2]" /> Configuración de Precios
        </h1>
        <p className="text-muted-foreground mt-1">
          Estos precios se aplican al contratar una suscripción y al aprobar
          solicitudes de paquete extra. Los cambios entran en efecto al instante.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planes y paquete extra</CardTitle>
          <CardDescription>
            El costo del paquete extra se descuenta automáticamente del saldo
            de billetera del cliente al momento de aprobar su solicitud.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando precios actuales…
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="estandarPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Estándar - precio mensual (MXN)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            className="pl-8 text-lg font-medium"
                            data-testid="input-estandar-price"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>Incluye 35 envíos mensuales.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="optimoPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Óptimo - precio mensual (MXN)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            className="pl-8 text-lg font-medium"
                            data-testid="input-optimo-price"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>Incluye 35 envíos mensuales.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="extraPackagePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paquete extra -” costo por bloque de 35 envíos (MXN)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            className="pl-8 text-lg font-medium"
                            data-testid="input-extra-package-price"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Se descuenta de la billetera del cliente cuando apruebas la solicitud.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="bg-[#00B5E2] hover:bg-[#0096BD]"
                  disabled={updateMutation.isPending}
                  data-testid="button-save-pricing"
                >
                  {updateMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Guardar precios
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



