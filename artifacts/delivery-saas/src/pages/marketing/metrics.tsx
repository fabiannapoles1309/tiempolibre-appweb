﻿import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Eye, ThumbsUp, Pencil, Check, X, BarChart2 } from "lucide-react";

interface MetricaCampana {
  id: number;
  campana: string;
  cliente: string;
  canal: string;
  views: number;
  interacciones: number;
  clicks: number;
  compartidos: number;
  periodo: string;
}

const initialMetricas: MetricaCampana[] = [
  { id: 1, campana: "Promo Ferreteria El Clavo", cliente: "Carlos Mendoza", canal: "Facebook / Instagram", views: 1240, interacciones: 87, clicks: 43, compartidos: 12, periodo: "May 2026" },
  { id: 2, campana: "Coleccion Primavera Boutique Alma", cliente: "Laura Torres", canal: "Instagram", views: 3850, interacciones: 312, clicks: 198, compartidos: 67, periodo: "Abr 2026" },
  { id: 3, campana: "Lanzamiento Don Pancho GDL", cliente: "Restaurante Don Pancho", canal: "Facebook / WhatsApp", views: 620, interacciones: 41, clicks: 19, compartidos: 5, periodo: "May 2026" },
];

export default function MarketingMetrics() {
  const [metricas, setMetricas] = useState<MetricaCampana[]>(initialMetricas);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<MetricaCampana>>({});

  const handleEdit = (m: MetricaCampana) => {
    setEditingId(m.id);
    setEditForm({ views: m.views, interacciones: m.interacciones, clicks: m.clicks, compartidos: m.compartidos, periodo: m.periodo });
  };

  const handleSave = (id: number) => {
    setMetricas((prev) => prev.map((m) => m.id === id ? { ...m, ...editForm } : m));
    setEditingId(null);
    setEditForm({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const totalViews = metricas.reduce((a, m) => a + m.views, 0);
  const totalInteracciones = metricas.reduce((a, m) => a + m.interacciones, 0);
  const totalClicks = metricas.reduce((a, m) => a + m.clicks, 0);
  const totalCompartidos = metricas.reduce((a, m) => a + m.compartidos, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-6 h-6 text-[#00B5E2]" />
        <div>
          <h1 className="text-2xl font-bold">Metricas de Campanas</h1>
          <p className="text-sm text-muted-foreground">Visualiza y edita el rendimiento de cada campana</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <Eye className="w-5 h-5 text-[#00B5E2] mx-auto mb-1" />
          <p className="text-2xl font-bold text-[#00B5E2]">{totalViews.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Views totales</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <ThumbsUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-600">{totalInteracciones.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Interacciones</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <TrendingUp className="w-5 h-5 text-orange-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-orange-600">{totalClicks.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Clicks</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <BarChart2 className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-purple-600">{totalCompartidos.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Compartidos</p>
        </CardContent></Card>
      </div>

      <div className="space-y-3">
        {metricas.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-4">
              {editingId === m.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{m.campana}</span>
                    <span className="text-xs text-muted-foreground">— {m.cliente}</span>
                    <Badge variant="outline">{m.canal}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Views</Label>
                      <Input type="number" value={editForm.views ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, views: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Interacciones</Label>
                      <Input type="number" value={editForm.interacciones ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, interacciones: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Clicks</Label>
                      <Input type="number" value={editForm.clicks ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, clicks: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Compartidos</Label>
                      <Input type="number" value={editForm.compartidos ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, compartidos: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <Label className="text-xs">Periodo</Label>
                    <Input value={editForm.periodo ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, periodo: e.target.value }))} placeholder="Ej: May 2026" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-[#00B5E2] hover:bg-[#0096BD]" onClick={() => handleSave(m.id)}>
                      <Check className="w-4 h-4 mr-1" /> Guardar
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancel}>
                      <X className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{m.campana}</span>
                      <span className="text-xs text-muted-foreground">— {m.cliente}</span>
                      <Badge variant="outline">{m.canal}</Badge>
                      <span className="text-xs text-muted-foreground">{m.periodo}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-muted/40 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-[#00B5E2]">{m.views.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Views</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-green-600">{m.interacciones.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Interacciones</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-orange-600">{m.clicks.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Clicks</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-purple-600">{m.compartidos.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Compartidos</p>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(m)}>
                    <Pencil className="w-4 h-4 mr-1" /> Editar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


