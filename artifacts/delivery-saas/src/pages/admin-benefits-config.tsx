﻿import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBenefitsConfig,
  usePutBenefitsConfig,
  getGetBenefitsConfigQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Award, Plus, Trash2, Save, Loader2 } from "lucide-react";

interface Level {
  level: number;
  deliveriesRequired: number;
  name: string;
}

export default function AdminBenefitsConfigPage() {
  const { data, isLoading } = useGetBenefitsConfig();
  const put = usePutBenefitsConfig();
  const qc = useQueryClient();
  const [levels, setLevels] = useState<Level[]>([]);

  useEffect(() => {
    if (data) {
      setLevels(
        data.map((d) => ({
          level: d.level,
          deliveriesRequired: d.deliveriesRequired,
          name: d.name,
        })),
      );
    }
  }, [data]);

  const update = (idx: number, patch: Partial<Level>) => {
    setLevels((prev) => {
      const copy = [...prev];
      const target = copy[idx];
      if (!target) return prev;
      copy[idx] = { ...target, ...patch };
      return copy;
    });
  };

  const remove = (idx: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== idx));
  };

  const add = () => {
    const nextLevel = levels.length > 0
      ? Math.max(...levels.map((l) => l.level)) + 1
      : 1;
    setLevels((prev) => [
      ...prev,
      { level: nextLevel, deliveriesRequired: 0, name: `Nivel ${nextLevel}` },
    ]);
  };

  const onSave = async () => {
    try {
      const payload = {
        levels: levels.map((l) => ({
          level: Number(l.level),
          deliveriesRequired: Number(l.deliveriesRequired),
          name: l.name,
        })),
      };
      await put.mutateAsync({ data: payload });
      toast.success("Beneficios actualizados");
      qc.invalidateQueries({ queryKey: getGetBenefitsConfigQueryKey() });
    } catch (e: any) {
      toast.error(e?.data?.error ?? "No se pudo guardar");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Award className="w-7 h-7 text-[#00B5E2]" /> ConfiguraciÃ³n de beneficios
        </h1>
        <p className="text-muted-foreground mt-1">
          DefinÃ­ los niveles de premios para repartidores segÃºn envÃ­os completados.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Niveles</CardTitle>
            <CardDescription>
              Cada nivel se desbloquea al alcanzar la cantidad de envÃ­os indicada.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={add} data-testid="button-add-level">
            <Plus className="w-4 h-4 mr-2" /> Agregar nivel
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : levels.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Sin niveles configurados. Agrega el primero.
            </div>
          ) : (
            levels.map((l, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-3 items-end border rounded-lg p-3"
                data-testid={`level-row-${idx}`}
              >
                <div className="col-span-2">
                  <Label className="text-xs">Nivel</Label>
                  <Input
                    type="number"
                    min={1}
                    value={l.level}
                    onChange={(e) =>
                      update(idx, { level: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">EnvÃ­os requeridos</Label>
                  <Input
                    type="number"
                    min={0}
                    value={l.deliveriesRequired}
                    onChange={(e) =>
                      update(idx, { deliveriesRequired: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="col-span-6">
                  <Label className="text-xs">Nombre / beneficio</Label>
                  <Input
                    value={l.name}
                    onChange={(e) => update(idx, { name: e.target.value })}
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(idx)}
                    aria-label="Eliminar nivel"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={onSave}
              disabled={put.isPending}
              className="bg-[#00B5E2] hover:bg-[#0096BD]"
              data-testid="button-save-benefits"
            >
              {put.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


