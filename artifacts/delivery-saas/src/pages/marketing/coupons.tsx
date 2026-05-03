import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Plus, Copy, CheckCircle, Trash2 } from "lucide-react";

interface Coupon {
  id: number;
  code: string;
  discount_type: "PERCENT" | "FIXED";
  discount_value: number;
  used: number;
  max: number;
  valid_until: string;
}

const initial: Coupon[] = [
  { id: 1, code: "BIENVENIDO20", discount_type: "PERCENT", discount_value: 20, used: 12, max: 100, valid_until: "2026-05-31" },
  { id: 2, code: "FLETE50", discount_type: "FIXED", discount_value: 50, used: 45, max: 50, valid_until: "2026-04-30" },
  { id: 3, code: "VERANO15", discount_type: "PERCENT", discount_value: 15, used: 8, max: 200, valid_until: "2026-06-30" },
];

export default function MarketingCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>(initial);
  const [copied, setCopied] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", discount_type: "PERCENT" as "PERCENT" | "FIXED", discount_value: "", max: "", valid_until: "" });

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAdd = () => {
    if (!form.code || !form.discount_value || !form.max) return;
    setCoupons([{ id: Date.now(), code: form.code.toUpperCase(), discount_type: form.discount_type, discount_value: Number(form.discount_value), used: 0, max: Number(form.max), valid_until: form.valid_until }, ...coupons]);
    setForm({ code: "", discount_type: "PERCENT", discount_value: "", max: "", valid_until: "" });
    setShowForm(false);
  };

  const handleDelete = (id: number) => setCoupons(coupons.filter(c => c.id !== id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <QrCode className="w-6 h-6 text-[#00B5E2]" />
          <h1 className="text-2xl font-bold">Cupones QR</h1>
        </div>
        <Button className="bg-[#00B5E2] hover:bg-[#0096BD]" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo cupón
        </Button>
      </div>

      {showForm && (
        <Card className="border-[#00B5E2]/30 bg-[#00B5E2]/5">
          <CardHeader><CardTitle className="text-base">Crear cupón</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código del cupón</Label>
                <Input placeholder="Ej: PROMO20" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de descuento</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as any }))}>
                  <option value="PERCENT">Porcentaje (%)</option>
                  <option value="FIXED">Monto fijo ($)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{form.discount_type === "PERCENT" ? "Porcentaje de descuento" : "Monto de descuento (MXN)"}</Label>
                <Input type="number" placeholder={form.discount_type === "PERCENT" ? "20" : "50"} value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Usos máximos</Label>
                <Input type="number" placeholder="100" value={form.max} onChange={e => setForm(f => ({ ...f, max: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Válido hasta</Label>
                <Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="bg-[#00B5E2] hover:bg-[#0096BD]" onClick={handleAdd} disabled={!form.code || !form.discount_value || !form.max}>Crear cupón</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coupons.map(coupon => (
          <Card key={coupon.id} className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#00B5E2]/5 rounded-bl-full" />
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#00B5E2]/10 text-[#0096BD]">
                  {coupon.discount_type === "PERCENT" ? `${coupon.discount_value}% OFF` : `$${coupon.discount_value} OFF`}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${coupon.used >= coupon.max ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                  {coupon.used >= coupon.max ? "Agotado" : "Activo"}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <code className="text-sm font-mono font-bold flex-1">{coupon.code}</code>
                <button onClick={() => handleCopy(coupon.code)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {copied === coupon.code ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Usos: {coupon.used}/{coupon.max}</span>
                {coupon.valid_until && <span>Vence: {coupon.valid_until}</span>}
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className="bg-[#00B5E2] h-1.5 rounded-full" style={{ width: `${Math.min((coupon.used / coupon.max) * 100, 100)}%` }} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1"><QrCode className="w-4 h-4 mr-1" /> Ver QR</Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(coupon.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


