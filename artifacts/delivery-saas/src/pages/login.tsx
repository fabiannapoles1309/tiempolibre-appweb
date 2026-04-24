import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";

const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

const DEMO_ACCOUNTS = [
  { role: "ADMIN", email: "admin@tiempolibre.com", password: "admin123" },
  { role: "CLIENTE", email: "cliente@tiempolibre.com", password: "cliente123" },
  { role: "DRIVER", email: "driver@tiempolibre.com", password: "driver123" },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      const res = await loginMutation.mutateAsync({ data });
      setUser(res.user);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("¡Bienvenido a TiempoLibre!");
      setLocation("/");
    } catch (error: any) {
      toast.error(error.data?.error || "Error al iniciar sesión");
    }
  };

  const fillDemo = (acc: { email: string; password: string }) => {
    form.setValue("email", acc.email);
    form.setValue("password", acc.password);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-[420px]">
          <div className="mb-10">
            <Logo heightPx={110} />
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
            Iniciar sesión
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ¿Aún no tenés cuenta?{" "}
            <Link href="/register" className="font-medium text-primary hover:text-primary/80">
              Crear una cuenta nueva
            </Link>
          </p>

          <div className="mt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electrónico</FormLabel>
                      <FormControl>
                        <Input placeholder="nombre@empresa.com" autoComplete="email" {...field} />
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
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full h-11 text-base" disabled={loginMutation.isPending}>
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
                <span className="bg-background px-3 text-muted-foreground">Credenciales de demo</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <Button
                  key={acc.role}
                  variant="outline"
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className="text-xs justify-start h-auto py-2.5 font-mono"
                >
                  <span className="font-bold w-20 text-primary">{acc.role}</span>
                  <span>{acc.email}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-[#00B5E2] via-[#0096BD] to-[#0B1E2D] flex items-center justify-center p-12">
          <div className="text-white max-w-2xl">
            <div className="mb-10 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur text-sm font-semibold tracking-wider uppercase">
              Somos tu sistema de reparto
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight mb-6 leading-tight">
              La logística de última milla, simplificada.
            </h1>
            <p className="text-xl opacity-90">
              Gestioná tus entregas, despachá a tus repartidores y controlá tus
              finanzas desde una sola plataforma unificada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
