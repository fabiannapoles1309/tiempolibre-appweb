import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBenefitsTracking,
  useSetBenefitClaim,
  getGetBenefitsTrackingQueryKey,
  useListBenefitItems,
  useCreateBenefitItem,
  useDeleteBenefitItem,
  useGetBenefitsConfig,
  getListBenefitItemsQueryKey,
  exportBenefitsTracking,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Award,
  Download,
  Loader2,
  Trash2,
  Plus,
  Fuel,
  Wrench,
  Stethoscope,
  Shield,
  Coffee,
  Gift,
  Zap,
  Crown,
  Star,
  Truck,
  Smartphone,
  Headphones,
  CircleCheck,
  CircleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Catálogo cerrado de beneficios disponibles (M2). El admin selecciona uno
// de estos 5 tipos al asignar beneficios a un nivel; el ícono se infiere.
const BENEFIT_TYPES: { name: string; icon: string; Icon: LucideIcon }[] = [
  { name: "Asistencia Médica", icon: "stethoscope", Icon: Stethoscope },
  { name: "Mantenimiento de Moto", icon: "wrench", Icon: Wrench },
  { name: "Vales de Gasolina", icon: "fuel", Icon: Fuel },
  { name: "Reparación de Celular (30% descuento)", icon: "smartphone", Icon: Smartphone },
  { name: "Accesorios para Celular (30% descuento)", icon: "headphones", Icon: Headphones },
];

const ICON_MAP: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  wrench: Wrench,
  fuel: Fuel,
  smartphone: Smartphone,
  headphones: Headphones,
  shield: Shield,
  coffee: Coffee,
  truck: Truck,
  crown: Crown,
  star: Star,
  zap: Zap,
  gift: Gift,
};

function iconFor(key: string): LucideIcon {
  return ICON_MAP[key] ?? Gift;
}

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function AdminBenefitsTrackingPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const qc = useQueryClient();
  const { data, isLoading } = useGetBenefitsTracking({ year, month });
  const { data: levels } = useGetBenefitsConfig();
  const { data: items } = useListBenefitItems();

  const setClaim = useSetBenefitClaim();
  const createItem = useCreateBenefitItem();
  const deleteItem = useDeleteBenefitItem();

  const [newItem, setNewItem] = useState({
    level: 1,
    typeIndex: 0,
    description: "",
  });

  const yearOptions = useMemo(() => {
    const cur = now.getUTCFullYear();
    return [cur - 2, cur - 1, cur, cur + 1];
  }, [now]);

  const onToggleClaim = async (
    driverId: number,
    benefitItemId: number,
    delivered: boolean,
  ) => {
    try {
      await setClaim.mutateAsync({
        data: { driverId, benefitItemId, year, month, delivered },
      });
      qc.invalidateQueries({
        queryKey: getGetBenefitsTrackingQueryKey({ year, month }),
      });
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "No se pudo actualizar el estatus");
    }
  };

  const onExport = async () => {
    try {
      const blob = await exportBenefitsTracking({ year, month });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tiempolibre_beneficios_${year}_${String(month).padStart(2, "0")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo generar el reporte");
    }
  };

  const onCreateItem = async () => {
    const type = BENEFIT_TYPES[newItem.typeIndex];
    if (!type) {
      toast.error("Selecciona un beneficio");
      return;
    }
    try {
      await createItem.mutateAsync({
        data: {
          level: Number(newItem.level),
          name: type.name,
          icon: type.icon,
          description: newItem.description.trim() || null,
        },
      });
      toast.success("Beneficio agregado");
      setNewItem({ level: newItem.level, typeIndex: 0, description: "" });
      qc.invalidateQueries({ queryKey: getListBenefitItemsQueryKey() });
      qc.invalidateQueries({
        queryKey: getGetBenefitsTrackingQueryKey({ year, month }),
      });
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } };
      toast.error(err?.data?.error ?? "No se pudo crear");
    }
  };

  const onDeleteItem = async (id: number) => {
    try {
      await deleteItem.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListBenefitItemsQueryKey() });
      qc.invalidateQueries({
        queryKey: getGetBenefitsTrackingQueryKey({ year, month }),
      });
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Award className="w-7 h-7 text-[#00B5E2]" />
          Seguimiento de Beneficios Mensuales
        </h1>
        <p className="text-muted-foreground mt-1">
          Valida el desempeño mensual de los repartidores y entrega los
          beneficios que han desbloqueado.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div>
              <Label className="text-xs">Mes</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
                <SelectTrigger className="w-44" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Año</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
                <SelectTrigger className="w-32" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={onExport}
            className="bg-[#00B5E2] hover:bg-[#0096BD]"
            data-testid="button-export-winners"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Ganadores a Excel
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          ) : !data || data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay repartidores registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repartidor</TableHead>
                    <TableHead className="text-center">Entregas (mes)</TableHead>
                    <TableHead>Nivel alcanzado</TableHead>
                    <TableHead className="w-[260px]">Progreso</TableHead>
                    <TableHead>Beneficios ganados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.driverId} data-testid={`row-driver-${row.driverId}`}>
                      <TableCell className="font-medium">{row.driverName}</TableCell>
                      <TableCell className="text-center font-bold text-lg">
                        {row.deliveries}
                      </TableCell>
                      <TableCell>
                        {row.currentLevel > 0 ? (
                          <Badge className="bg-[#00B5E2]/15 text-[#0096BD] border-0">
                            Nivel {row.currentLevel}
                            {row.currentLevelName ? ` Â· ${row.currentLevelName}` : ""}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin nivel aún
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={row.progressPct} className="h-2" />
                          <div className="text-xs text-muted-foreground">
                            {row.nextLevelTarget != null ? (
                              <>
                                {row.deliveries} / {row.nextLevelTarget} para
                                {" "}
                                <strong>
                                  Nivel {row.nextLevel}
                                  {row.nextLevelName ? ` Â· ${row.nextLevelName}` : ""}
                                </strong>
                              </>
                            ) : (
                              <span>Nivel máximo alcanzado</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.benefits.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Aún no desbloquea beneficios
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {row.benefits.map((b) => {
                              const Icon = iconFor(b.icon);
                              const delivered = b.status === "ENTREGADO";
                              return (
                                <div
                                  key={b.benefitItemId}
                                  className="flex items-center justify-between gap-3 px-2 py-1 rounded-md bg-muted/30"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Icon className="w-4 h-4 text-[#00B5E2] shrink-0" />
                                    <span className="text-sm truncate">{b.name}</span>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={delivered ? "secondary" : "default"}
                                    onClick={() =>
                                      onToggleClaim(
                                        row.driverId,
                                        b.benefitItemId,
                                        !delivered,
                                      )
                                    }
                                    className={
                                      delivered
                                        ? ""
                                        : "bg-amber-500 hover:bg-amber-600 text-white"
                                    }
                                    data-testid={`button-claim-${row.driverId}-${b.benefitItemId}`}
                                  >
                                    {delivered ? (
                                      <>
                                        <CircleCheck className="w-3.5 h-3.5 mr-1" />
                                        Entregado
                                      </>
                                    ) : (
                                      <>
                                        <CircleAlert className="w-3.5 h-3.5 mr-1" />
                                        Por reclamar
                                      </>
                                    )}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#00B5E2]" />
            Catálogo de beneficios por nivel
          </CardTitle>
          <CardDescription>
            Define los beneficios concretos (ej. "Vales de gasolina") que se
            desbloquean al alcanzar cada nivel configurado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-2">
              <Label className="text-xs">Nivel</Label>
              <Select
                value={String(newItem.level)}
                onValueChange={(v) => setNewItem({ ...newItem, level: Number(v) })}
              >
                <SelectTrigger data-testid="select-new-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(levels ?? []).map((l) => (
                    <SelectItem key={l.id} value={String(l.level)}>
                      {l.level} - {l.name}
                    </SelectItem>
                  ))}
                  {(!levels || levels.length === 0) && (
                    <SelectItem value="1">1</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-5">
              <Label className="text-xs">Beneficio</Label>
              <Select
                value={String(newItem.typeIndex)}
                onValueChange={(v) =>
                  setNewItem({ ...newItem, typeIndex: Number(v) })
                }
              >
                <SelectTrigger data-testid="select-new-benefit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BENEFIT_TYPES.map((t, i) => (
                    <SelectItem key={t.name} value={String(i)}>
                      <span className="inline-flex items-center gap-2">
                        <t.Icon className="w-4 h-4" /> {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Notas (opcional)</Label>
              <Input
                value={newItem.description}
                onChange={(e) =>
                  setNewItem({ ...newItem, description: e.target.value })
                }
                placeholder="Detalle interno"
                data-testid="input-new-benefit-desc"
              />
            </div>
            <div className="md:col-span-2">
              <Button
                onClick={onCreateItem}
                disabled={createItem.isPending}
                className="w-full bg-[#00B5E2] hover:bg-[#0096BD]"
                data-testid="button-add-benefit-item"
              >
                {createItem.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Agregar
              </Button>
            </div>
          </div>

          {(items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay beneficios cargados todavía.
            </p>
          ) : (
            <div className="border rounded-md divide-y">
              {(items ?? []).map((it) => {
                const Icon = iconFor(it.icon);
                return (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                    data-testid={`row-benefit-item-${it.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="outline">Nivel {it.level}</Badge>
                      <Icon className="w-4 h-4 text-[#00B5E2]" />
                      <span className="text-sm font-medium truncate">{it.name}</span>
                      {it.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          â€” {it.description}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteItem(it.id)}
                      data-testid={`button-delete-benefit-item-${it.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



