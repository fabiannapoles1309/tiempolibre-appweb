import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      const res = await loginMutation.mutateAsync({ data });
      setUser(res.user);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("¡Bienvenido a Rapidoo!");
      setLocation("/");
    } catch (error: any) {
      toast.error(error.data?.error || "Error al iniciar sesión");
    }
  };

  const fillDemo = (email: string) => {
    form.setValue("email", email);
    form.setValue("password", email.split("@")[0] + "123");
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight mb-8">
            <Truck className="w-8 h-8" />
            <span>RAPIDOO</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
            Iniciar sesión
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O{" "}
            <Link href="/register" className="font-medium text-primary hover:text-primary/80">
              crea una cuenta nueva
            </Link>
          </p>

          <div className="mt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electrónico</FormLabel>
                      <FormControl>
                        <Input placeholder="nombre@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Entrar al sistema
                </Button>
              </form>
            </Form>

            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-2 text-muted-foreground">Credenciales de demo</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <Button variant="outline" onClick={() => fillDemo("admin@rapidoo.com")} className="text-xs justify-start h-auto py-2">
                <span className="font-bold w-16">ADMIN</span> admin@rapidoo.com
              </Button>
              <Button variant="outline" onClick={() => fillDemo("cliente@rapidoo.com")} className="text-xs justify-start h-auto py-2">
                <span className="font-bold w-16">CLIENTE</span> cliente@rapidoo.com
              </Button>
              <Button variant="outline" onClick={() => fillDemo("driver@rapidoo.com")} className="text-xs justify-start h-auto py-2">
                <span className="font-bold w-16">DRIVER</span> driver@rapidoo.com
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-primary h-full w-full object-cover">
          <div className="h-full w-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center p-12">
             <div className="text-primary-foreground max-w-2xl">
               <h1 className="text-5xl font-extrabold tracking-tight mb-6">
                 La logística de última milla, simplificada.
               </h1>
               <p className="text-xl opacity-90">
                 Gestiona tus entregas, despacha a tus repartidores y controla tus finanzas desde una sola plataforma unificada.
               </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
