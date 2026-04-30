import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Truck, Users, Send } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL ?? "";

type Person = { id: number; name: string; email: string };

export default function AdminMessagingPage() {
  const [tab,         setTab]         = useState<"DRIVER"|"CLIENT">("DRIVER");
  const [recipientId, setRecipientId] = useState<string>("ALL");
  const [message,     setMessage]     = useState("");

  const { data: drivers = [], isLoading: ld } = useQuery<Person[]>({
    queryKey: ["messaging-drivers"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/admin/messaging/drivers`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: clientes = [], isLoading: lc } = useQuery<Person[]>({
    queryKey: ["messaging-clientes"],
    queryFn: async () => {
      const r = await fetch(`${API}/api/admin/messaging/clientes`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/api/admin/messaging/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientType: tab,
          recipientId:   recipientId === "ALL" ? null : Number(recipientId),
          message,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || "Error al enviar mensaje");
      }
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(
        data.sent === 1
          ? "✅ Mensaje enviado correctamente"
          : `✅ Mensaje enviado a ${data.sent} destinatarios`
      );
      setMessage("");
      setRecipientId("ALL");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const people  = tab === "DRIVER" ? drivers : clientes;
  const loading = tab === "DRIVER" ? ld      : lc;
  const canSend = message.trim().length > 0 && !mutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-[#00B5E2]" /> Mensajería
        </h1>
        <p className="text-muted-foreground mt-1">
          Envía mensajes a drivers o clientes de forma individual o masiva.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo mensaje</CardTitle>
          <CardDescription>
            Elige a quién enviar y escribe el mensaje.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Tabs Driver / Cliente */}
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "DRIVER"|"CLIENT"); setRecipientId("ALL"); }}>
            <TabsList className="grid grid-cols-2 w-full max-w-xs">
              <TabsTrigger value="DRIVER" className="flex items-center gap-1">
                <Truck className="w-4 h-4" /> Drivers
              </TabsTrigger>
              <TabsTrigger value="CLIENT" className="flex items-center gap-1">
                <Users className="w-4 h-4" /> Clientes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="DRIVER" className="mt-4 space-y-4">
              <DestinatarioSelector
                people={drivers}
                loading={ld}
                value={recipientId}
                onChange={setRecipientId}
                label="driver"
              />
            </TabsContent>

            <TabsContent value="CLIENT" className="mt-4 space-y-4">
              <DestinatarioSelector
                people={clientes}
                loading={lc}
                value={recipientId}
                onChange={setRecipientId}
                label="cliente"
              />
            </TabsContent>
          </Tabs>

          {/* Destinatario seleccionado */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Enviando a:</span>
            {recipientId === "ALL" ? (
              <Badge className="bg-[#00B5E2] hover:bg-[#00B5E2] text-white">
                Todos los {tab === "DRIVER" ? "drivers" : "clientes"} ({people.length})
              </Badge>
            ) : (
              <Badge variant="outline">
                {people.find((p) => String(p.id) === recipientId)?.name ?? "—"}
              </Badge>
            )}
          </div>

          {/* Mensaje */}
          <div className="space-y-1">
            <Label>Mensaje</Label>
            <Textarea
              placeholder="Escribe tu mensaje aquí..."
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length} caracteres
            </p>
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSend}
            className="bg-[#00B5E2] hover:bg-[#009ec8] text-white"
          >
            <Send className="w-4 h-4 mr-2" />
            {mutation.isPending ? "Enviando..." : "Enviar mensaje"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DestinatarioSelector({
  people, loading, value, onChange, label,
}: {
  people:   Person[];
  loading:  boolean;
  value:    string;
  onChange: (v: string) => void;
  label:    string;
}) {
  return (
    <div className="space-y-1">
      <Label>Selecciona {label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Cargando..." : `Todos los ${label}s`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">
            📢 Todos los {label}s
          </SelectItem>
          {people.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name} — {p.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
