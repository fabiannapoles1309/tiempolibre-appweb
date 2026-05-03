﻿import { useState } from "react";
import {
  useListIncidents,
  useCreateIncident,
  useUpdateIncident,
  IncidentType,
  IncidentStatus,
  getListIncidentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, isAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  ACCIDENTE: "Accidente",
  ROBO: "Robo",
  DEMORA: "Demora",
  CLIENTE_AUSENTE: "Cliente ausente",
  VEHICULO: "VehÃ­culo",
  OTRO: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_REVISION: "En revisiÃ³n",
  RESUELTO: "Resuelto",
};

const STATUS_COLORS: Record<string, string> = {
  ABIERTO: "bg-red-100 text-red-700 border-red-300",
  EN_REVISION: "bg-amber-100 text-amber-700 border-amber-300",
  RESUELTO: "bg-green-100 text-green-700 border-green-300",
};

export default function IncidentsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const { data: incidents = [], isLoading } = useListIncidents();
  const create = useCreateIncident();
  const update = useUpdateIncident();
  const qc = useQueryClient();

  const [type, setType] = useState<IncidentType>(IncidentType.DEMORA);
  const [orderId, setOrderId] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 5) {
      toast.error("Contanos un poco mÃ¡s sobre lo que pasÃ³");
      return;
    }
    try {
      await create.mutateAsync({
        data: {
          type,
          orderId: orderId.trim() ? Number(orderId) : null,
          description: description.trim(),
        },
      });
      toast.success("Reporte enviado");
      setDescription("");
      setOrderId("");
      qc.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
    } catch {
      toast.error("No se pudo enviar el reporte");
    }
  };

  const changeStatus = async (id: number, status: IncidentStatus) => {
    try {
      await update.mutateAsync({ id, data: { status } });
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
    } catch {
      toast.error("No se pudo actualizar");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-7 h-7 text-[#00B5E2]" />
          {admin ? "Incidentes reportados" : "Mis incidentes"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {admin
            ? "Seguimiento de todos los reportes de los repartidores."
            : "ReportÃ¡ lo que pasa en la calle. El equipo va a revisarlo."}
        </p>
      </div>

      {!admin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="w-4 h-4" /> Reportar nuevo incidente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                  <Select value={type} onValueChange={(v) => setType(v as IncidentType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(IncidentType).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABELS[t] ?? t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    NÂ° de envÃ­o (opcional)
                  </label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="Ej: 1234"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Â¿QuÃ© pasÃ³?</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Contanos los detalles..."
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={create.isPending}
                  className="bg-[#00B5E2] hover:bg-[#0096BD]"
                >
                  {create.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                    </>
                  ) : (
                    "Enviar reporte"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          ) : incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay incidentes registrados.</p>
          ) : (
            <div className="space-y-3">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-3"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold">#{inc.id}</span>
                      <Badge variant="outline">{TYPE_LABELS[inc.type] ?? inc.type}</Badge>
                      <Badge className={STATUS_COLORS[inc.status] ?? ""} variant="outline">
                        {STATUS_LABELS[inc.status] ?? inc.status}
                      </Badge>
                      {inc.orderId ? (
                        <span className="text-xs text-muted-foreground">
                          EnvÃ­o #{inc.orderId}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm">{inc.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {admin ? `${inc.driverName} Â· ` : ""}
                      {new Date(inc.createdAt).toLocaleString("es-MX")}
                    </p>
                  </div>
                  {admin ? (
                    <Select
                      value={inc.status}
                      onValueChange={(v) => changeStatus(inc.id, v as IncidentStatus)}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(IncidentStatus).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s] ?? s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


