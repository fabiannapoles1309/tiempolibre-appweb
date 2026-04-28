import { useState } from "react";
import { useListDrivers, useCreateDriver, useUpdateDriver, useDeleteDriver, useSettleDriverCash, getListDriversQueryKey, ZoneName } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { VEHICLE_TYPES, VEHICLE_TYPE_SET } from "@/lib/vehicle-types";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";

const driverSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  phone: z.string().min(1, "El teléfono es requerido"),
  vehicle: z
    .string()
    .min(1, "El vehículo es requerido")
    .refine((v) => VEHICLE_TYPE_SET.has(v), "Selecciona un tipo de vehículo válido"),
  zones: z.array(z.nativeEnum(ZoneName)).min(1, "Selecciona al menos una zona"),
  active: z.boolean().default(true),
  licensePlate: z.string().optional(),
  circulationCard: z.string().optional(),
});

export default function Drivers() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<number | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingDriver, setDeletingDriver] = useState<number | null>(null);

  const { data: drivers, isLoading } = useListDrivers();
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();
  const deleteDriver = useDeleteDriver();
  const settleCash = useSettleDriverCash();

  const form = useForm<z.infer<typeof driverSchema>>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: "",
      phone: "",
      vehicle: "",
      zones: [],
      active: true,
      licensePlate: "",
      circulationCard: "",
    },
  });

  const handleOpenCreate = () => {
    setEditingDriver(null);
    form.reset({
      name: "",
      phone: "",
      vehicle: "",
      zones: [],
      active: true,
      licensePlate: "",
      circulationCard: "",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (driver: any) => {
    setEditingDriver(driver.id);
    form.reset({
      name: driver.name,
      phone: driver.phone,
      vehicle: driver.vehicle,
      zones: driver.zones,
      active: driver.active,
      licensePlate: driver.licensePlate ?? "",
      circulationCard: driver.circulationCard ?? "",
    });
    setIsCreateOpen(true);
  };

  const onSubmit = async (data: z.infer<typeof driverSchema>) => {
    try {
      const payload = {
        ...data,
        licensePlate: data.licensePlate?.trim() ? data.licensePlate.trim() : undefined,
        circulationCard: data.circulationCard?.trim() ? data.circulationCard.trim() : undefined,
      };
      if (editingDriver) {
        await updateDriver.mutateAsync({ id: editingDriver, data: payload as any });
        toast.success("Repartidor actualizado correctamente");
      } else {
        await createDriver.mutateAsync({ data: payload as any });
        toast.success("Repartidor creado correctamente");
      }
      queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
      setIsCreateOpen(false);
    } catch (error: any) {
      toast.error(error?.data?.error || "Error al guardar repartidor");
    }
  };

  const handleSettle = async (driverId: number, amount: number) => {
    try {
      await settleCash.mutateAsync({ id: driverId, data: { amount } });
      toast.success("Liquidación registrada");
      queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
    } catch {
      toast.error("No se pudo liquidar");
    }
  };

  const handleDelete = async () => {
    if (!deletingDriver) return;
    try {
      await deleteDriver.mutateAsync({ id: deletingDriver });
      toast.success("Repartidor eliminado");
      queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
      setIsDeleteOpen(false);
    } catch (error: any) {
      toast.error(error?.data?.error || "Error al eliminar");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repartidores</h1>
          <p className="text-muted-foreground mt-1">Gestioná el equipo de entrega y sus zonas de cobertura.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo repartidor
          </Button>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingDriver ? "Editar repartidor" : "Nuevo repartidor"}</DialogTitle>
              <DialogDescription>
                Completá los datos del repartidor para agregarlo al sistema.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Juan Pérez" {...field} />
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
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="+54 11..." {...field} />
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
                          <SelectTrigger data-testid="select-driver-vehicle">
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
                <FormField
                  control={form.control}
                  name="zones"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Zonas de cobertura</FormLabel>
                        <FormDescription>Selecciona las zonas donde operará.</FormDescription>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.values(ZoneName).map((zone) => (
                          <FormField
                            key={zone}
                            control={form.control}
                            name="zones"
                            render={({ field }) => {
                              return (
                                <FormItem key={zone} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(zone)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, zone])
                                          : field.onChange(field.value?.filter((value) => value !== zone));
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal text-sm cursor-pointer">{zone}</FormLabel>
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
                <div className="grid grid-cols-2 gap-3">
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
                          <Input placeholder="N° de tarjeta" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Estado Activo</FormLabel>
                        <FormDescription>
                          El repartidor puede recibir asignaciones.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createDriver.isPending || updateDriver.isPending} className="w-full sm:w-auto">
                    {(createDriver.isPending || updateDriver.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar repartidor?</DialogTitle>
              <DialogDescription>
                Esta acción no se puede deshacer. El repartidor ya no podrá acceder al sistema ni recibir pedidos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteDriver.isPending}>
                {deleteDriver.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !drivers || drivers.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No hay repartidores</h3>
              <p className="text-muted-foreground">Agrega tu primer repartidor para comenzar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Vehículo / Placas</TableHead>
                  <TableHead>Zonas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Efectivo a rendir</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.phone}</TableCell>
                    <TableCell>
                      <div>{driver.vehicle}</div>
                      {driver.licensePlate ? (
                        <div className="text-xs text-muted-foreground">Placas: {driver.licensePlate}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {driver.zones.map(zone => (
                          <Badge key={zone} variant="secondary" className="text-xs">{zone}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {driver.active ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="mr-1 h-3 w-3" /> Activo</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground"><XCircle className="mr-1 h-3 w-3" /> Inactivo</Badge>
                      )}
                      {driver.status ? (
                        <div className="text-[10px] text-muted-foreground mt-1">{driver.status}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-semibold">$ {Number(driver.cashPending ?? 0).toLocaleString("es-MX")}</div>
                      {Number(driver.cashPending ?? 0) > 0 ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => handleSettle(driver.id, Number(driver.cashPending))}
                          disabled={settleCash.isPending}
                        >
                          Liquidar todo
                        </Button>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(driver)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { setDeletingDriver(driver.id); setIsDeleteOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FormDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
