﻿import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Plus, Facebook, Instagram, MessageCircle, ExternalLink, Pencil, Check, X } from "lucide-react";

type Canal = "Facebook" | "Instagram" | "WhatsApp";
type Estado = "BORRADOR" | "ACTIVA" | "FINALIZADA";

interface UrlCanal {
  canal: Canal;
  url: string;
}

interface Campaign {
  id: number;
  title: string;
  cliente: string;
  descripcion: string;
  urls: UrlCanal[];
  estado: Estado;
  fecha_inicio: string;
  fecha_fin: string;
  views: number;
  interacciones: number;
}

const estadoColor: Record<Estado, string> = {
  BORRADOR: "bg-gray-100 text-gray-700",
  ACTIVA: "bg-green-100 text-green-700",
  FINALIZADA: "bg-blue-100 text-blue-700",
};

const canalIcon: Record<Canal, React.ElementType> = {
  Facebook: Facebook,
  Instagram: Instagram,
  WhatsApp: MessageCircle,
};

const initialCampaigns: Campaign[] = [
  {
    id: 1,
    title: "Promo Ferreteria El Clavo",
    cliente: "Carlos Mendoza",
    descripcion: "Campana de herramientas en oferta para mayo.",
    urls: [
      { canal: "Facebook", url: "https://facebook.com/posts/ejemplo1" },
      { canal: "Instagram", url: "https://instagram.com/p/ejemplo1" },
    ],
    estado: "ACTIVA",
    fecha_inicio: "2026-05-01",
    fecha_fin: "2026-05-31",
    views: 1240,
    interacciones: 87,
  },
  {
    id: 2,
    title: "Coleccion Primavera Boutique Alma",
    cliente: "Laura Torres",
    descripcion: "Reels y stories para nueva coleccion.",
    urls: [{ canal: "Instagram", url: "https://instagram.com/p/ejemplo2" }],
    estado: "FINALIZADA",
    fecha_inicio: "2026-04-01",
    fecha_fin: "2026-04-30",
    views: 3850,
    interacciones: 312,
  },
];

const CANALES: Canal[] = ["Facebook", "Instagram", "WhatsApp"];

const emptyForm = {
  title: "",
  cliente: "",
  descripcion: "",
  urls: [] as UrlCanal[],
  estado: "BORRADOR" as Estado,
  fecha_inicio: "",
  fecha_fin: "",
  views: 0,
  interacciones: 0,
};

export default function MarketingCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [urlInputs, setUrlInputs] = useState<UrlCanal[]>([{ canal: "Facebook", url: "" }]);

  const handleAddUrl = () => setUrlInputs((prev) => [...prev, { canal: "Facebook", url: "" }]);
  const handleUrlChange = (i: number, field: keyof UrlCanal, value: string) => {
    setUrlInputs((prev) => prev.map((u, idx) => idx === i ? { ...u, [field]: value } : u));
  };
  const handleRemoveUrl = (i: number) => setUrlInputs((prev) => prev.filter((_, idx) => idx !== i));

  const handleGuardar = () => {
    if (!form.title || !form.cliente) return;
    const validUrls = urlInputs.filter((u) => u.url.trim() !== "");
    if (editingId !== null) {
      setCampaigns((prev) => prev.map((c) => c.id === editingId ? { ...c, ...form, urls: validUrls } : c));
      setEditingId(null);
    } else {
      const nueva: Campaign = { id: Date.now(), ...form, urls: validUrls };
      setCampaigns((prev) => [nueva, ...prev]);
    }
    setForm({ ...emptyForm });
    setUrlInputs([{ canal: "Facebook", url: "" }]);
    setShowForm(false);
  };

  const handleEdit = (c: Campaign) => {
    setForm({
      title: c.title,
      cliente: c.cliente,
      descripcion: c.descripcion,
      urls: c.urls,
      estado: c.estado,
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin,
      views: c.views,
      interacciones: c.interacciones,
    });
    setUrlInputs(c.urls.length > 0 ? c.urls : [{ canal: "Facebook", url: "" }]);
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setForm({ ...emptyForm });
    setUrlInputs([{ canal: "Facebook", url: "" }]);
    setEditingId(null);
    setShowForm(false);
  };

  const totalViews = campaigns.reduce((a, c) => a + c.views, 0);
  const totalInteracciones = campaigns.reduce((a, c) => a + c.interacciones, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-[#00B5E2]" />
          <div>
            <h1 className="text-2xl font-bold">Campanas</h1>
            <p className="text-sm text-muted-foreground">Gestiona campanas de clientes TiempoLibre</p>
          </div>
        </div>
        <Button className="bg-[#00B5E2] hover:bg-[#0096BD]" onClick={() => { handleCancel(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nueva campana
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-[#00B5E2]">{campaigns.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Campanas totales</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-[#00B5E2]">{totalViews.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">Views totales</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-[#00B5E2]">{totalInteracciones.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">Interacciones totales</p>
        </CardContent></Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "Editar campana" : "Nueva campana"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Titulo de la campana</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej: Promo mayo Ferreteria" />
              </div>
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} placeholder="Nombre del cliente" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descripcion</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Objetivo y detalles de la campana..." rows={2} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>URLs del contenido publicado</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddUrl}>+ Agregar URL</Button>
              </div>
              {urlInputs.map((u, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={u.canal} onValueChange={(v) => handleUrlChange(i, "canal", v)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CANALES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="flex-1" value={u.url} onChange={(e) => handleUrlChange(i, "url", e.target.value)} placeholder="https://..." />
                  {urlInputs.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveUrl(i)}>
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm((f) => ({ ...f, estado: v as Estado }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BORRADOR">Borrador</SelectItem>
                    <SelectItem value="ACTIVA">Activa</SelectItem>
                    <SelectItem value="FINALIZADA">Finalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fecha inicio</Label>
                <Input type="date" value={form.fecha_inicio} onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Fecha fin</Label>
                <Input type="date" value={form.fecha_fin} onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Views</Label>
                <Input type="number" value={form.views} onChange={(e) => setForm((f) => ({ ...f, views: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1 max-w-xs">
              <Label>Interacciones</Label>
              <Input type="number" value={form.interacciones} onChange={(e) => setForm((f) => ({ ...f, interacciones: Number(e.target.value) }))} />
            </div>
            <div className="flex gap-2">
              <Button className="bg-[#00B5E2] hover:bg-[#0096BD]" onClick={handleGuardar}>
                <Check className="w-4 h-4 mr-1" /> Guardar
              </Button>
              <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{c.title}</span>
                    <Badge className={estadoColor[c.estado]}>{c.estado}</Badge>
                    <span className="text-xs text-muted-foreground">Cliente: {c.cliente}</span>
                  </div>
                  {c.descripcion && <p className="text-sm text-muted-foreground">{c.descripcion}</p>}
                  <div className="flex flex-wrap gap-2">
                    {c.urls.map((u, i) => {
                      const Icon = canalIcon[u.canal];
                      return (
                        <a key={i} href={u.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border hover:bg-muted transition-colors">
                          <Icon className="w-3 h-3" />
                          {u.canal}
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </a>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{c.fecha_inicio} — {c.fecha_fin}</span>
                    <span className="font-medium text-foreground">{c.views.toLocaleString()} views</span>
                    <span className="font-medium text-foreground">{c.interacciones.toLocaleString()} interacciones</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


