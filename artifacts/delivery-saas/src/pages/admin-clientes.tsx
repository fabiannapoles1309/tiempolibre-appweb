import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useAdminListClientes,
  useAdminUpdateCliente,
  useAdminRechargeCliente,
  useAdminRenewCliente,
  getAdminListClientesQueryKey,
  SubscriptionTier,
  type AdminClienteRow,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Pencil, Plus, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const editSchema = z.object({
  name: z.string().min(1, "Requerido"),
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
  phone: z.string().optional(),
  tier: z.union([z.nativeEnum(SubscriptionTier), z.literal("")]).optional(),
});

type EditValues = z.infer<typeof editSchema>;

function statusBadge(status: string | null | undefined) {
  if (!status) return <Badge variant="outline">Sin plan</Badge>;
  if (status === "ACTIVA") return <Badge className="bg-emerald-500 text-white">Activa</Badge>;
  if (status === "VENCIDA") return <Badge className="bg-amber-500 text-white">Vencida</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function AdminClientesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useAdminListClientes();
  const update = useAdminUpdateCliente();
  const recharge = useAdminRechargeCliente();
  const renew = useAdminRenewCliente();

  const [editing, setEditing] = useState<AdminClienteRow | null>(null);

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      businessName: "",
      pickupAddress: "",
      clienteZone: undefined,
      phone: "",
      tier: "",
    },
  });

  const openEdit = (row: AdminClienteRow) => {
    setEditing(row);
    form.reset({
      name: row.name,
      businessName: row.businessName ?? "",
      pickupAddress: row.pickupAddress ?? "",
      clienteZone: row.clienteZone ?? undefined,
      phone: row.phone ?? "",
      tier: (row.tier as SubscriptionTier | null) ?? "",
    });
  };

  const closeEdit = () => setEditing(null);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: getAdminListClientesQueryKey() });

  const onSubmit = async (values: EditValues) => {
    if (!editing) return;
    try {
      const payload: Record<string, unknown> = {
        name: values.name,
        businessName: values.businessName ?? "",
        pickupAddress: values.pickupAddress ?? "",
        clienteZone: values.clienteZone ?? null,
        phone: values.phone ?? "",
      };
      if (values.tier) payload.tier = values.tier;
      await update.mutateAsync({ id: editing.id, data: payload as never });
      toast.success("Cliente actualizado");
      refresh();
      closeEdit();
    } catch (e: any) {
      toast.error(e?.data?.error ?? "No se pudo actualizar el cliente");
    }
  };

  const handleRecharge = async (row: AdminClienteRow) => {
    try {
      await recharge.mutateAsync({ id: row.id });
      toast.success(`Recarga aplicada a ${row.name} (+35 envíos)`);
      refresh();
    } catch (e: any) {
      toast.error(e?.data?.error ?? "No se pudo recargar");
    }
  };

  const handleRenew = async (row: AdminClienteRow) => {
    try {
      await renew.mutateAsync({ id: row.id });
      toast.success(`Suscripción renovada para ${row.name}`);
      refresh();
    } catch (e: any) {
      toast.error(e?.data?.error ?? "No se pudo renovar");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-[#00B5E2]" /> Clientes
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona el perfil del cliente, su plan y los bloques de envíos asignados.
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>
            {data?.length ?? 0} clientes registrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Aún no hay clientes registrados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Establecimiento</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Restantes</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id} data-testid={`row-cliente-${row.id}`}>
                    <TableCell
                      className="font-mono text-xs"
                      data-testid={`text-customer-code-${row.id}`}
                    >
                      {row.customerCode ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </TableCell>
                    <TableCell>{row.businessName ?? "—"}</TableCell>
                    <TableCell>
                      {row.clienteZone != null ? `Zona ${row.clienteZone}` : "—"}
                    </TableCell>
                    <TableCell>
                      {row.tier ? (
                        <Badge variant="secondary" className="text-xs">
                          {row.tier}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {row.remainingDeliveries}/{row.monthlyDeliveries}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(row)}
                          data-testid={`button-edit-${row.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          className="bg-[#00B5E2] hover:bg-[#0096BD]"
                          onClick={() => handleRecharge(row)}
                          disabled={recharge.isPending || !row.tier}
                          title={!row.tier ? "El cliente no tiene plan activo" : "Sumar 35 envíos"}
                          data-testid={`button-recharge-${row.id}`}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Recargar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRenew(row)}
                          disabled={renew.isPending || !row.tier}
                          title={!row.tier ? "El cliente no tiene plan que renovar" : "Reactivar plan"}
                          data-testid={`button-renew-${row.id}`}
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Renovar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-cliente">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>
              Actualiza el perfil, la zona de operación y el plan del cliente.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Establecimiento</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="clienteZone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zona (1-100)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={100}
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
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Plan</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v)}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Mantener actual" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={SubscriptionTier.ESTANDAR}>
                            Estándar (35)
                          </SelectItem>
                          <SelectItem value={SubscriptionTier.OPTIMO}>
                            Óptimo (70)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={closeEdit}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={update.isPending}
                  className="bg-[#00B5E2] hover:bg-[#0096BD]"
                  data-testid="button-save-cliente"
                >
                  {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
