import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send, Users, Facebook, Instagram, Check, Plus } from "lucide-react";

type Canal = "WhatsApp" | "Facebook" | "Instagram" | "Email";
type Audiencia = "Todos los clientes" | "Clientes activos" | "Clientes nuevos" | "Segmento especifico";
type Estado = "BORRADOR" | "ENVIADO" | "PROGRAMADO";

interface Mensaje {
  id: number;
  titulo: string;
  contenido: string;
  canal: Canal;
  audiencia: Audiencia;
  destinatarios: number;
  estado: Estado;
  fecha: string;
}

const canalColor: Record<Canal, string> = {
  WhatsApp: "bg-green-100 text-green-700",
  Facebook: "bg-blue-100 text-blue-700",
  Instagram: "bg-pink-100 text-pink-700",
  Email: "bg-orange-100 text-orange-700",
};

const estadoColor: Record<Estado, string> = {
  BORRADOR: "bg-gray-100 text-gray-700",
  ENVIADO: "bg-green-100 text-green-700",
  PROGRAMADO: "bg-blue-100 text-blue-700",
};

const initialMensajes: Mensaje[] = [
  { id: 1, titulo: "Promo mayo Ferreteria El Clavo", contenido: "Aprovecha descuentos en herramientas este mes. Entregas a domicilio con TiempoLibre.", canal: "WhatsApp", audiencia: "Todos los clientes", destinatarios: 210, estado: "ENVIADO", fecha: "2026-04-28" },
  { id: 2, titulo: "Nueva coleccion Boutique Alma", contenido: "Descubre la coleccion primavera 2026. Envios express disponibles.", canal: "Instagram", audiencia: "Clientes activos", destinatarios: 145, estado: "ENVIADO", fecha: "2026-04-24" },
  { id: 3, titulo: "Lanzamiento campana mayo", contenido: "Conoce nuestras nuevas promociones para el mes de mayo.", canal: "Facebook", audiencia: "Todos los clientes", destinatarios: 320, estado: "PROGRAMADO", fecha: "2026-05-01" },
];

const emptyForm = {
  titulo: "",
  contenido: "",
  canal: "WhatsApp" as Canal,
  audiencia: "Todos los clientes" as Audiencia,
  destinatarios: 0,
  estado: "BORRADOR" as Estado,
  fecha: "",
};

export default function MarketingMessaging() {
  const [mensajes, setMensajes] = useState<Mensaje[]>(initialMensajes);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const handleGuardar = () => {
    if (!form.titulo || !form.contenido) return;
    if (editingId !== null) {
      setMensajes((prev) => prev.map((m) => m.id === editingId ? { ...m, ...form } : m));
      setEditingId(null);
    } else {
      setMensajes((prev) => [{ id: Date.now(), ...form }, ...prev]);
    }
    setForm({ ...emptyForm });
    setShowForm(false);
  };

  const handleEdit = (m: Mensaje) => {
    setForm({ titulo: m.titulo, contenido: m.contenido, canal: m.canal, audiencia: m.audiencia, destinatarios: m.destinatarios, estado: m.estado, fecha: m.fecha });
    setEditingId(m.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(false);
  };

  const totalDestinatarios = mensajes.reduce((a, m) => a + m.destinatarios, 0);
  const totalEnviados = mensajes.filter((m) => m.estado === "ENVIADO").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-[#00B5E2]" />
          <div>
            <h1 className="text-2xl font-bold">Mensajeria de Campanas</h1>
            <p className="text-sm text-muted-foreground">Envia mensajes de campanas a clientes de la red TiempoLibre</p>
          </div>
        </div>
        <Button className="bg-[#00B5E2] hover:bg-[#0096BD]" onClick={() => { handleCancel(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo mensaje
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-[#00B5E2]">{mensajes.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Mensajes totales</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-[#00B5E2]">{totalEnviados}</p>
          <p className="text-sm text-muted-foreground mt-1">Mensajes enviados</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-[#00B5E2]">{totalDestinatarios.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">Destinatarios alcanzados</p>
        </CardContent></Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "Editar mensaje" : "Nuevo mensaje de campana"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Titulo del mensaje</Label>
              <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Promo mayo Ferreteria El Clavo" />
            </div>
            <div className="space-y-1">
              <Label>Contenido del mensaje</Label>
              <Textarea value={form.contenido} onChange={(e) => setForm((f) => ({ ...f, contenido: e.target.value }))} placeholder="Escribe el mensaje que recibiran los clientes..." rows={4} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Canal</Label>
                <Select value={form.canal} onValueChange={(v) => setForm((f) => ({ ...f, canal: v as Canal }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Audiencia</Label>
                <Select value={form.audiencia} onValueChange={(v) => setForm((f) => ({ ...f, audiencia: v as Audiencia }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos los clientes">Todos los clientes</SelectItem>
                    <SelectItem value="Clientes activos">Clientes activos</SelectItem>
                    <SelectItem value="Clientes nuevos">Clientes nuevos</SelectItem>
                    <SelectItem value="Segmento especifico">Segmento especifico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm((f) => ({ ...f, estado: v as Estado }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BORRADOR">Borrador</SelectItem>
                    <SelectItem value="PROGRAMADO">Programado</SelectItem>
                    <SelectItem value="ENVIADO">Enviado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1 max-w-xs">
              <Label>Num. destinatarios</Label>
              <Input type="number" value={form.destinatarios} onChange={(e) => setForm((f) => ({ ...f, destinatarios: Number(e.target.value) }))} />
            </div>
            <div className="flex gap-2">
              <Button className="bg-[#00B5E2] hover:bg-[#0096BD]" onClick={handleGuardar}>
                <Send className="w-4 h-4 mr-1" /> Guardar
              </Button>
              <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {mensajes.map((m) => (
          <Card key={m.id}>
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{m.titulo}</span>
                    <Badge className={canalColor[m.canal]}>{m.canal}</Badge>
                    <Badge className={estadoColor[m.estado]}>{m.estado}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.contenido}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{m.audiencia}</span>
                    <span>{m.destinatarios.toLocaleString()} destinatarios</span>
                    <span>{m.fecha}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleEdit(m)}>
                  Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}



