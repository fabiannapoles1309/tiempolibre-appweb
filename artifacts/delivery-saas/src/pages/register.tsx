import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, getGetMeQueryKey, UserRole } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";

const registerSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.nativeEnum(UserRole),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: UserRole.CLIENTE,
    },
  });

  const onSubmit = async (data: z.infer<typeof registerSchema>) => {
    try {
      const res = await registerMutation.mutateAsync({ data });
      setUser(res.user);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("¡Cuenta creada exitosamente!");
      setLocation("/");
    } catch (error: any) {
      toast.error(error.data?.error || "Error al crear cuenta");
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-8">
            <Logo heightPx={110} />
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
            Crear cuenta
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O{" "}
            <Link href="/login" className="font-medium text-primary hover:text-primary/80">
              inicia sesión si ya tienes una
            </Link>
          </p>

          <div className="mt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol (Demo)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UserRole.CLIENTE}>Cliente (Crea pedidos)</SelectItem>
                          <SelectItem value={UserRole.DRIVER}>Repartidor (Hace entregas)</SelectItem>
                          <SelectItem value={UserRole.ADMIN}>Administrador (Control total)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                  {registerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Registrarse
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 h-full w-full bg-gradient-to-bl from-[#00B5E2] via-[#0096BD] to-[#0B1E2D] flex items-center justify-center p-12">
          <div className="text-white max-w-2xl">
            <h1 className="text-5xl font-extrabold tracking-tight mb-6">
              Hacé crecer tu negocio con entregas rápidas.
            </h1>
            <p className="text-xl opacity-90">
              Sumate a las empresas que confían en TiempoLibre para su logística de última milla.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
