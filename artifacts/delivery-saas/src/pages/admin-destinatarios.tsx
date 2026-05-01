import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Download, Search, Check, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

type AdminRecipient = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  allowMarketingSms: boolean;
  allowMarketingEmail: boolean;
  orderCount: number;
  lastUsedAt: string;
  createdAt: string;
  cliente: {
    customerId: number;
    businessName: string | null;
    name: string;
    email: string;
  };
};

export default function AdminDestinatariosPage() {
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery<AdminRecipient[]>({
    queryKey: ["admin-recipients", q],
    queryFn: async () => {
      const url = q.trim()
        ? `/api/admin/recipients?q=${encodeURIComponent(q.trim())}`
        : `/api/admin/recipients`;
      const r = await apiFetch(url, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  const [downloading, setDownloading] = useState(false);
  const handleExport = async () => {
    setDownloading(true);
    try {
      const r = await apiFetch("/api/admin/recipients/export", { credentials: "include" });
      if (!r.ok) throw new Error("export-failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `destinatarios_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo exportar el archivo");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-7 h-7 text-[#00B5E2]" /> Destinatarios
          </h1>
          <p className="text-muted-foreground mt-1">
            Directorio construido a partir de los envíos realizados por cada
            cliente. Incluye los consentimientos de marketing del destinatario.
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={downloading}
          className="bg-[#00B5E2] hover:bg-[#0096BD] text-white"
          data-testid="button-export-recipients"
        >
          <Download className="w-4 h-4 mr-2" />
          {downloading ? "Generando..." : "Descargar Excel"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>
            Buscador por nombre del destinatario, teléfono, cliente o
            establecimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar..."
              className="pl-9"
              data-testid="input-search-recipients"
            />
          </div>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead className="text-center">SMS</TableHead>
                  <TableHead className="text-center">Email</TableHead>
                  <TableHead className="text-right">Envíos</TableHead>
                  <TableHead>Ãƒâ€œÃ…¡ltimo envío</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Aón no hay destinatarios registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((r) => (
                    <TableRow key={r.id} data-testid={`row-recipient-${r.id}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {r.cliente.businessName || r.cliente.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {r.cliente.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-sm">{r.phone}</TableCell>
                      <TableCell className="text-sm" data-testid={`text-recipient-email-${r.id}`}>
                        {r.email ? (
                          <span className="break-all">{r.email}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.allowMarketingSms ? (
                          <Check className="inline w-4 h-4 text-green-600" />
                        ) : (
                          <X className="inline w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.allowMarketingEmail ? (
                          <Check className="inline w-4 h-4 text-green-600" />
                        ) : (
                          <X className="inline w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{r.orderCount}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(r.lastUsedAt), "dd MMM yyyy, HH:mm", { locale: es })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


