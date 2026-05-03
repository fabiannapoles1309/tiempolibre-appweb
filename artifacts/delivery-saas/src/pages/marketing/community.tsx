import { useState } from "react";
import { Facebook, Instagram, MessageCircle, Plus, Copy, Check, TrendingUp, Users, FileText, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Canal = "Facebook" | "Instagram" | "WhatsApp";
type Objetivo = "Branding" | "Ventas" | "Engagement" | "Leads";
type Estado = "BORRADOR" | "ENVIADA" | "ACEPTADA" | "RECHAZADA";

interface Cotizacion {
  id: number;
  prospecto: string;
  empresa: string;
  canales: Canal[];
  objetivo: Objetivo;
  presupuesto: string;
  notas: string;
  estado: Estado;
  fecha: string;
}

const estadoColor: Record<Estado, string> = {
  BORRADOR: "bg-gray-100 text-gray-700",
  ENVIADA: "bg-blue-100 text-blue-700",
  ACEPTADA: "bg-green-100 text-green-700",
  RECHAZADA: "bg-red-100 text-red-700",
};

const canalIcon: Record<Canal, React.ElementType> = {
  Facebook: Facebook,
  Instagram: Instagram,
  WhatsApp: MessageCircle,
};

const initialCotizaciones: Cotizacion[] = [
  { id: 1, prospecto: "Carlos Mendoza", empresa: "Ferreteria El Clavo", canales: ["Facebook", "WhatsApp"], objetivo: "Ventas", presupuesto: "5000", notas: "Campana mensual para promocion de herramientas.", estado: "ENVIADA", fecha: "2026-04-27" },
  { id: 2, prospecto: "Laura Torres", empresa: "Boutique Alma", canales: ["Instagram"], objetivo: "Branding", presupuesto: "3500", notas: "Reels y stories para nueva coleccion primavera.", estado: "ACEPTADA", fecha: "2026-04-24" },
  { id: 3, prospecto: "Restaurante Don Pancho", empresa: "Don Pancho GDL", canales: ["Facebook", "Instagram", "WhatsApp"], objetivo: "Engagement", presupuesto: "8000", notas: "Estrategia completa redes sociales.", estado: "BORRADOR", fecha: "2026-04-29" },
];

function generarResumen(c: Cotizacion): string {
  return (
    "Cotizacion TiempoLibre Marketing\n\n" +
    "Prospecto: " + c.prospecto + "\n" +
    "Empresa: " + c.empresa + "\n" +
    "Canales: " + c.canales.join(", ") + "\n" +
    "Objetivo: " + c.objetivo + "\n" +
    "Presupuesto: $" + c.presupuesto + " MXN\n" +
    (c.notas ? "Notas: " + c.notas + "\n" : "") +
    "\nGracias por considerar TiempoLibre Marketing."
  );
}

export default function MarketingCommunity() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>(initialCotizaciones);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [form, setForm] = useState({
    prospecto: "",
    empresa: "",
    canales: [] as Canal[],
    objetivo: "Branding" as Objetivo,
    presupuesto: "",
    notas: "",
  });

  const toggleCanal = (canal: Canal) => {
    setForm((f) => ({
      ...f,
      canales: f.canales.includes(canal)
        ? f.canales.filter((c) => c !== canal)
        : [...f.canales, canal],
    }));
  };

  const handleGuardar = () => {
    if (!form.prospecto || !form.empresa || form.canales.length === 0 || !form.presupuesto) return;
    const nueva: Cotizacion = {
      id: Date.now(),
      ...form,
      estado: "BORRADOR",
      fecha: new Date().toISOString().slice(0, 10),
    };
    setCotizaciones((prev) => [nueva, ...prev]);
    setForm({ prospecto: "", empresa: "", canales: [], objetivo: "Branding", presupuesto: "", notas: "" });
    setShowForm(false);
  };

  const handleEstado = (id: number, estado: Estado) => {
    setCotizaciones(cotizaciones.map((c) => (c.id === id ? { ...c, estado } : c)));
  };

  const handleCopy = (c: Cotizacion) => {
    navigator.clipboard.writeText(generarResumen(c));
    setCopied(c.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const totalAceptado = cotizaciones
    .filter((c) => c.estado === "ACEPTADA")
    .reduce((a, c) => a + Number(c.presupuesto), 0);

  const canales: Canal[] = ["Facebook", "Instagram", "WhatsApp"];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comunidad & Cotizaciones</h1>
          <p className="text-muted-foreground text-sm">Gestiona prospectos y cotizaciones de marketing</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Cotizacion
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{cotizaciones.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Aceptadas</p>
                <p className="text-xl font-bold">{cotizaciones.filter((c) => c.estado === "ACEPTADA").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Enviadas</p>
                <p className="text-xl font-bold">{cotizaciones.filter((c) => c.estado === "ENVIADA").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">Ingresos</p>
                <p className="text-xl font-bold">${totalAceptado.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva Cotizacion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Prospecto</Label>
                <Input value={form.prospecto} onChange={(e) => setForm((f) => ({ ...f, prospecto: e.target.value }))} placeholder="Nombre del contacto" />
              </div>
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Input value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} placeholder="Nombre de la empresa" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Canales</Label>
              <div className="flex gap-2">
                {canales.map((c) => {
                  const Icon = canalIcon[c];
                  return (
                    <Button
                      key={c}
                      type="button"
                      variant={form.canales.includes(c) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleCanal(c)}
                    >
                      <Icon className="w-4 h-4 mr-1" />
                      {c}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Objetivo</Label>
                <Select value={form.objetivo} onValueChange={(v) => setForm((f) => ({ ...f, objetivo: v as Objetivo }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Branding">Branding</SelectItem>
                    <SelectItem value="Ventas">Ventas</SelectItem>
                    <SelectItem value="Engagement">Engagement</SelectItem>
                    <SelectItem value="Leads">Leads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Presupuesto (MXN)</Label>
                <Input type="number" value={form.presupuesto} onChange={(e) => setForm((f) => ({ ...f, presupuesto: e.target.value }))} placeholder="Ej: 5000" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Detalles adicionales..." rows={3} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGuardar}>Guardar</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {cotizaciones.map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{c.prospecto}</span>
                    <span className="text-muted-foreground text-sm">— {c.empresa}</span>
                    <Badge className={estadoColor[c.estado]}>{c.estado}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {c.canales.map((canal) => {
                      const Icon = canalIcon[canal];
                      return <Icon key={canal} className="w-4 h-4 text-muted-foreground" />;
                    })}
                    <span className="text-xs text-muted-foreground">{c.objetivo}</span>
                    <span className="text-xs font-medium text-green-700">${Number(c.presupuesto).toLocaleString()} MXN</span>
                    <span className="text-xs text-muted-foreground">{c.fecha}</span>
                  </div>
                  {c.notas && <p className="text-xs text-muted-foreground mt-1">{c.notas}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select value={c.estado} onValueChange={(v) => handleEstado(c.id, v as Estado)}>
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BORRADOR">Borrador</SelectItem>
                      <SelectItem value="ENVIADA">Enviada</SelectItem>
                      <SelectItem value="ACEPTADA">Aceptada</SelectItem>
                      <SelectItem value="RECHAZADA">Rechazada</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => handleCopy(c)}>
                    {copied === c.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


