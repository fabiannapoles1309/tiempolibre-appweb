import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Save, X, Plus, Trash2, PackageSearch } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL ?? "";

type ShippingCost = {
  id:              number;
  name:            string;
  amount:          number;
  insuranceAmount: number;
};

export default function ShippingCostsPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData,  setEditData]  = useState({ amount: "", insuranceAmount: "" });
  const [newRow,    setNewRow]    = useState({ name: "", amount: "", insuranceAmount: "" });
  const [showNew,   setShowNew]   = useState(false);

  const { data: costs = [], isLoading } = useQuery<ShippingCost[]>({
    queryKey: ["shipping-costs"],
    queryFn:  async () => {
      const r = await apiFetch(`${API}/api/admin/shipping-costs`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Editar costo existente
  const editMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiFetch(`${API}/api/admin/shipping-costs/${id}`, {
        method:      "PATCH",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount:          Number(editData.amount),
          insuranceAmount: Number(editData.insuranceAmount),
        }),
      });
      if (!r.ok) throw new Error("Error al actualizar");
      return r.json();
    },
    onSuccess: () => {
      toast.success("✅ Costo actualizado correctamente");
      qc.invalidateQueries({ queryKey: ["shipping-costs"] });
      setEditingId(null);
    },
    onError: () => toast.error("Error al actualizar el costo"),
  });

  // Crear nuevo costo
  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch(`${API}/api/admin/shipping-costs`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:            newRow.name,
          amount:          Number(newRow.amount),
          insuranceAmount: Number(newRow.insuranceAmount),
        }),
      });
      if (!r.ok) throw new Error("Error al crear");
      return r.json();
    },
    onSuccess: () => {
      toast.success("✅ Costo creado correctamente");
      qc.invalidateQueries({ queryKey: ["shipping-costs"] });
      setShowNew(false);
      setNewRow({ name: "", amount: "", insuranceAmount: "" });
    },
    onError: () => toast.error("Error al crear el costo"),
  });

  // Eliminar costo
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiFetch(`${API}/api/admin/shipping-costs/${id}`, {
        method:      "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Error al eliminar");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Costo eliminado");
      qc.invalidateQueries({ queryKey: ["shipping-costs"] });
    },
    onError: () => toast.error("Error al eliminar el costo"),
  });

  const startEdit = (cost: ShippingCost) => {
    setEditingId(cost.id);
    setEditData({
      amount:          String(cost.amount),
      insuranceAmount: String(cost.insuranceAmount),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <PackageSearch className="w-7 h-7 text-[#00B5E2]" /> Costos de envío
        </h1>
        <p className="text-muted-foreground mt-1">
          Modifica el costo de envío y seguro de reparto de cada servicio.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Servicios de envío</CardTitle>
            <CardDescription>
              Haz clic en el ícono de edición para modificar un costo.
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowNew(true)}
            className="bg-[#00B5E2] hover:bg-[#009ec8] text-white"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" /> Nuevo
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Costo envío</TableHead>
                  <TableHead>Seguro reparto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <>
                    {costs.map((cost) => (
                      <TableRow key={cost.id}>
                        <TableCell className="font-medium">{cost.name}</TableCell>

                        {editingId === cost.id ? (
                          <>
                            <TableCell>
                              <Input
                                type="number"
                                value={editData.amount}
                                onChange={(e) =>
                                  setEditData((d) => ({ ...d, amount: e.target.value }))
                                }
                                className="w-28 h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={editData.insuranceAmount}
                                onChange={(e) =>
                                  setEditData((d) => ({ ...d, insuranceAmount: e.target.value }))
                                }
                                className="w-28 h-8"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => editMutation.mutate(cost.id)}
                                  disabled={editMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700 text-white h-8"
                                >
                                  <Save className="w-3 h-3 mr-1" />
                                  {editMutation.isPending ? "..." : "Guardar"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingId(null)}
                                  className="h-8"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-mono">
                              ${cost.amount.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-mono">
                              ${cost.insuranceAmount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEdit(cost)}
                                  className="h-8"
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteMutation.mutate(cost.id)}
                                  disabled={deleteMutation.isPending}
                                  className="h-8"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}

                    {/* Fila para nuevo costo */}
                    {showNew && (
                      <TableRow className="bg-muted/30">
                        <TableCell>
                          <Input
                            placeholder="Nombre del servicio"
                            value={newRow.name}
                            onChange={(e) =>
                              setNewRow((d) => ({ ...d, name: e.target.value }))
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={newRow.amount}
                            onChange={(e) =>
                              setNewRow((d) => ({ ...d, amount: e.target.value }))
                            }
                            className="w-28 h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={newRow.insuranceAmount}
                            onChange={(e) =>
                              setNewRow((d) => ({ ...d, insuranceAmount: e.target.value }))
                            }
                            className="w-28 h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => createMutation.mutate()}
                              disabled={!newRow.name || createMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white h-8"
                            >
                              <Save className="w-3 h-3 mr-1" />
                              {createMutation.isPending ? "..." : "Crear"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowNew(false)}
                              className="h-8"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {costs.length === 0 && !showNew && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No hay costos registrados. Crea el primero.
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

