import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Search, Pencil, Check, X, Building2, Phone, Mail } from "lucide-react";

type Giro = "Comercio" | "Restaurante" | "Boutique" | "Ferreteria" | "Servicios" | "Otro";
type EstadoCliente = "ACTIVO" | "PROSPECTO" | "INACTIVO";

interface ClienteMarketing {
  id: number;
  nombre: string;
  empresa: string;
  giro: Giro;
  email: string;
  telefono: string;
  estado: EstadoCliente;
  campanas: number;
  fecha_alta: string;
  notas: string;
}

const estadoColor: Record<EstadoCliente, string> = {
  ACTIVO: "bg-green-100 text-green-700",
  PROSPECTO: "bg-yellow-100 text-yellow-700",
  INACTIVO: "bg-gray-100 text-gray-700",
};

const initialClientes: ClienteMarketing[] = [
  { id: 1, nombre: "Carlos Mendoza", empresa: "Ferreteria El Clavo", giro: "Ferreteria", email: "carlos@elclavo.com", telefono: "3311223344", estado: "ACTIVO", campanas: 2, fecha_alta: "2026-03-10", notas: "Cliente frecuente, prefiere WhatsApp." },
  { id: 2, nombre: "Laura Torres", empresa: "Boutique Alma", giro: "Boutique", email: "laura@boutiqueAlma.com", telefono: "3398765432", estado: "ACTIVO", campanas: 1, fecha_alta: "2026-04-01", notas: "Campanas enfocadas en Instagram." },
  { id: 3, nombre: "Don Pancho", empresa: "Restaurante Don Pancho GDL", giro: "Restaurante", email: "pancho@donpancho.mx", telefono: "3312341234", estado: "PROSPECTO", campanas: 0, fecha_alta: "2026-04-29", notas: "Interesado en paquete completo redes sociales." },
];

const emptyForm: Omit<ClienteMarketing, "id"> = {
  nombre: "",
  empresa: "",
  giro: "Comercio",
  email: "",
  telefono: "",
  estado: "PROSPECTO",
  campanas: 0,
  fecha_alta: new Date().toISOString().slice(0, 10),
  notas: "",
};

const GIROS: Giro[] = ["Comercio", "Restaurante", "Boutique", "Ferreteria", "Servicios", "Otro"];

export default function MarketingClientes() {
  const [clientes, setClientes] = useState<ClienteMarketing[]>(initialClientes);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<ClienteMarketing, "id">>({ ...emptyForm });
  const [busqueda, setBusqueda] = useState("");

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.empresa.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.email.toLowerCase().includes(busqueda.toLowerCase())
  );

  const handleGuardar = () => {
    if (!form.nombre || !form.empresa || !form.email) return;
    if (editingId !== null) {
      setClientes((prev) => prev.map((c) => c.id === editingId ? { ...c, ...form } : c));
      setEditingId(null);
    } else {
      setClientes((prev) => [{ id: Date.now(), ...form }, ...prev]);
    }
    setForm({ ...emptyForm });
    setShowForm(false);
  };

  const handleEdit = (c: ClienteMarketing) => {
    setForm({ nombre: c.nombre, empresa: c.empresa, giro: c.giro, email: c.email, telefono: c.telefono, estado: c.estado, campanas: c.campanas, fecha_alta: c.fecha_alta, notas: c.notas });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(false);
  };

  const totalActivos = clientes.filter((c) => c.estado === "ACTIVO").length;
  const totalProspectos = clientes.filter((c) => c.estado === "PROSPECTO").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-[#00B5E2]" />
          <div>
            <h1 className="text-2xl font-bold">Clientes Marketing</h1>
            <p className="text-sm text-muted-foreground">Clientes de la red TiempoLibre para campanas</p>
          </div>
        </div>
        <Button className="bg-[#00B5E2] hover:bg-[#0096BD]" onClick={() => { handleCancel(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo cliente
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-[#00B5E2]">{clientes.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Total clientes</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-green-600">{totalActivos}</p>
          <p className="text-sm text-muted-foreground mt-1">Clientes activos</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-3xl font-bold text-yellow-600">{totalProspectos}</p>
          <p className="text-sm text-muted-foreground mt-1">Prospectos</p>
        </CardContent></Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "Editar cliente" : "Nuevo cliente de marketing"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nombre del contacto</Label>
                <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo" />
              </div>
              <div className="space-y-1">
                <Label>Empresa / Negocio</Label>
                <Input value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} placeholder="Nombre del negocio" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Giro</Label>
                <Select value={form.giro} onValueChange={(v) => setForm((f) => ({ ...f, giro: v as Giro }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GIROS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="contacto@empresa.com" />
              </div>
              <div className="space-y-1">
                <Label>Telefono</Label>
                <Input value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="33 1234 5678" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm((f) => ({ ...f, estado: v as EstadoCliente }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROSPECTO">Prospecto</SelectItem>
                    <SelectItem value="ACTIVO">Activo</SelectItem>
                    <SelectItem value="INACTIVO">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fecha de alta</Label>
                <Input type="date" value={form.fecha_alta} onChange={(e) => setForm((f) => ({ ...f, fecha_alta: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Preferencias, observaciones..." />
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

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nombre, empresa o email..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      <div className="space-y-3">
        {clientesFiltrados.map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{c.nombre}</span>
                    <Badge className={estadoColor[c.estado]}>{c.estado}</Badge>
                    <span className="text-xs text-muted-foreground">{c.campanas} campana{c.campanas !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    <span>{c.empresa}</span>
                    <span className="mx-1">·</span>
                    <span>{c.giro}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefono}</span>
                    <span>Alta: {c.fecha_alta}</span>
                  </div>
                  {c.notas && <p className="text-xs text-muted-foreground italic">{c.notas}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {clientesFiltrados.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">No se encontraron clientes.</div>
        )}
      </div>
    </div>
  );
}


