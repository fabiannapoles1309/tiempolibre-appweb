import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useAdminCreateUser,
  AdminCreateUserBodyRole,
  ZoneName,
  SubscriptionTier,
} from "@workspace/api-client-react";
import { VEHICLE_TYPES, VEHICLE_TYPE_SET } from "@/lib/vehicle-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, UserPlus, Copy, Check } from "lucide-react";

const schema = z.object({
  role: z.nativeEnum(AdminCreateUserBodyRole),
  name: z.string().min(1, "Requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  // Cliente
  tier: z.nativeEnum(SubscriptionTier).optional(),
  businessName: z.string().optional(),
  pickupAddress: z.string().optional(),
  clienteZone: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 1 && v <= 100),
      "Zona entre 1 y 100",
    ),
  // Driver + Cliente
  phone: z.string().optional(),
  // Driver
  vehicle: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || v === "" || VEHICLE_TYPE_SET.has(v),
      "Selecciona un tipo de vehículo válido",
    ),
  zones: z.array(z.nativeEnum(ZoneName)).optional(),
  licensePlate: z.string().optional(),
  circulationCard: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function AdminUsersPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [welcomeDriverName, setWelcomeDriverName] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const create = useAdminCreateUser();

  const handleCopy = async () => {
    if (!welcomeMessage) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(welcomeMessage);
      } else {
        const ta = document.createElement("textarea");
        ta.value = welcomeMessage;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("Mensaje copiado al portapapeles");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto manualmente.");
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: AdminCreateUserBodyRole.CLIENTE,
      name: "",
      email: "",
      password: "",
      tier: SubscriptionTier.ESTANDAR,
      businessName: "",
      pickupAddress: "",
      clienteZone: undefined,
      phone: "",
      vehicle: "",
      zones: [],
      licensePlate: "",
      circulationCard: "",
    },
  });

  const role = form.watch("role");

  const onSubmit = async (data: FormValues) => {
    try {
      const payload: any = {
        role: data.role,
        name: data.name,
        email: data.email,
        password: data.password,
      };
      if (data.role === AdminCreateUserBodyRole.CLIENTE) {
        if (data.tier) payload.tier = data.tier;
        if (data.businessName) payload.businessName = data.businessName;
        if (data.pickupAddress) payload.pickupAddress = data.pickupAddress;
        if (data.clienteZone !== undefined) payload.clienteZone = data.clienteZone;
        if (data.phone) payload.phone = data.phone;
      }
      if (data.role === AdminCreateUserBodyRole.DRIVER) {
        payload.phone = data.phone ?? "";
        payload.vehicle = data.vehicle ?? "";
        payload.zones = data.zones ?? [];
        if (data.licensePlate) payload.licensePlate = data.licensePlate;
        if (data.circulationCard) payload.circulationCard = data.circulationCard;
      }
      const created = await create.mutateAsync({ data: payload });
      toast.success("Usuario creado correctamente");
      // Si el backend devolvió el mensaje de bienvenida (drivers), abrimos el modal.
      if (data.role === AdminCreateUserBodyRole.DRIVER && created?.welcomeMessage) {
        setWelcomeDriverName(data.name);
        setWelcomeMessage(created.welcomeMessage);
        setCopied(false);
      }
      form.reset({
        role: data.role,
        name: "",
        email: "",
        password: "",
        tier: SubscriptionTier.ESTANDAR,
        businessName: "",
        pickupAddress: "",
        clienteZone: undefined,
        phone: "",
        vehicle: "",
        zones: [],
        licensePlate: "",
        circulationCard: "",
      });
    } catch (e: any) {
      toast.error(e?.data?.error ?? "No se pudo crear el usuario");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserPlus className="w-7 h-7 text-[#00B5E2]" /> Crear usuario
        </h1>
        <p className="text-muted-foreground mt-1">
          Alta de cuentas: clientes con plan inicial o repartidores con datos del vehículo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del usuario</CardTitle>
          <CardDescription>
            Elige el rol y completa los campos requeridos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={AdminCreateUserBodyRole.CLIENTE}>
                          Cliente
                        </SelectItem>
                        <SelectItem value={AdminCreateUserBodyRole.DRIVER}>
                          Repartidor
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre completo o razón social" {...field} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="usuario@dominio.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña inicial</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres"
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? "Ocultar" : "Ver"}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {role === AdminCreateUserBodyRole.CLIENTE && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="businessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del establecimiento</FormLabel>
                          <FormControl>
                            <Input placeholder="Tacos Don Pepe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono de contacto</FormLabel>
                          <FormControl>
                            <Input placeholder="+52 55 ..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="pickupAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección de recolección</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Calle, número, colonia, alcaldía"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clienteZone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zona asignada (1-100)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              placeholder="Ej. 12"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === "" ? undefined : e.target.value,
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan inicial (opcional)</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sin plan" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={SubscriptionTier.ESTANDAR}>
                                Estándar
                              </SelectItem>
                              <SelectItem value={SubscriptionTier.OPTIMO}>
                                Ãƒâ€œptimo
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {role === AdminCreateUserBodyRole.DRIVER && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="+52 55 ..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vehicle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de vehículo</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? ""}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-vehicle-type">
                                <SelectValue placeholder="Selecciona el vehículo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {VEHICLE_TYPES.map((v) => (
                                <SelectItem key={v} value={v}>
                                  {v}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="licensePlate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Placa</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC-1234" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="circulationCard"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tarjeta de Circulación</FormLabel>
                          <FormControl>
                            <Input placeholder="NÃƒâ€šÃ‚Â°" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="zones"
                    render={() => (
                      <FormItem>
                        <FormLabel>Zonas asignadas</FormLabel>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {Object.values(ZoneName).map((zone) => (
                            <FormField
                              key={zone}
                              control={form.control}
                              name="zones"
                              render={({ field }) => {
                                const list = field.value ?? [];
                                return (
                                  <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={list.includes(zone)}
                                        onCheckedChange={(checked) => {
                                          field.onChange(
                                            checked
                                              ? [...list, zone]
                                              : list.filter((z) => z !== zone),
                                          );
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal text-sm cursor-pointer">
                                      {zone}
                                    </FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <Button
                type="submit"
                disabled={create.isPending}
                className="w-full md:w-auto bg-[#00B5E2] hover:bg-[#0096BD]"
                data-testid="button-create-user"
              >
                {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear usuario
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog
        open={!!welcomeMessage}
        onOpenChange={(open) => {
          if (!open) {
            setWelcomeMessage(null);
            setWelcomeDriverName("");
            setCopied(false);
          }
        }}
      >
        <DialogContent className="max-w-lg" data-testid="dialog-welcome-message">
          <DialogHeader>
            <DialogTitle>Mensaje de bienvenida para {welcomeDriverName || "el repartidor"}</DialogTitle>
            <DialogDescription>
              Cópialo y envíaselo por SMS o WhatsApp. Incluye sus accesos y el enlace a la app.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            readOnly
            value={welcomeMessage ?? ""}
            rows={12}
            className="font-mono text-sm"
            data-testid="textarea-welcome-message"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setWelcomeMessage(null)}
              data-testid="button-close-welcome"
            >
              Cerrar
            </Button>
            <Button
              onClick={handleCopy}
              className="bg-[#00B5E2] hover:bg-[#0096BD]"
              data-testid="button-copy-welcome"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" /> Copiar al portapapeles
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
