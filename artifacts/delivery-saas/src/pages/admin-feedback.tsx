import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Inbox, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type AdminFeedbackRow = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: "ADMIN" | "SUPERUSER" | "CLIENTE" | "DRIVER";
  type: "QUEJA" | "SUGERENCIA";
  subject: string;
  message: string;
  createdAt: string;
};

export default function AdminFeedbackPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"ALL" | "QUEJA" | "SUGERENCIA">("ALL");

  const { data = [], isLoading } = useQuery<AdminFeedbackRow[]>({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const r = await apiFetch("/api/admin/feedback", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter((f) => {
      if (filter !== "ALL" && f.type !== filter) return false;
      if (!term) return true;
      return (
        f.subject.toLowerCase().includes(term) ||
        f.message.toLowerCase().includes(term) ||
        f.userName.toLowerCase().includes(term) ||
        f.userEmail.toLowerCase().includes(term)
      );
    });
  }, [data, q, filter]);

  const counts = useMemo(() => {
    let q = 0;
    let s = 0;
    for (const f of data) {
      if (f.type === "QUEJA") q++;
      else s++;
    }
    return { quejas: q, sugerencias: s, total: data.length };
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Inbox className="w-7 h-7 text-[#00B5E2]" /> Buzón de quejas y
          sugerencias
        </h1>
        <p className="text-muted-foreground mt-1">
          Mensajes enviados por clientes, repartidores o el propio personal.
          Cada nuevo mensaje también se notifica por correo a este equipo.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total recibidos</p>
            <p className="text-3xl font-bold">{counts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Quejas</p>
            <p className="text-3xl font-bold text-red-600">{counts.quejas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sugerencias</p>
            <p className="text-3xl font-bold text-[#00B5E2]">
              {counts.sugerencias}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mensajes</CardTitle>
          <CardDescription>
            Los más recientes primero. Filtra por tipo o busca por usuario,
            asunto o contenido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuario, asunto o mensaje"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
                data-testid="input-feedback-search"
              />
            </div>
            <div className="flex gap-2">
              {(["ALL", "QUEJA", "SUGERENCIA"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilter(opt)}
                  className={`px-3 py-2 rounded-md text-sm border ${
                    filter === opt
                      ? "bg-[#00B5E2] text-white border-[#00B5E2]"
                      : "bg-white text-muted-foreground hover:bg-muted/50"
                  }`}
                  data-testid={`button-filter-${opt.toLowerCase()}`}
                >
                  {opt === "ALL"
                    ? "Todos"
                    : opt === "QUEJA"
                      ? "Quejas"
                      : "Sugerencias"}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="w-[120px]">Tipo</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Mensaje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No hay mensajes para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((f) => (
                    <TableRow
                      key={f.id}
                      data-testid={`row-feedback-${f.id}`}
                    >
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(f.createdAt), "dd MMM yyyy HH:mm", {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{f.userName}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.userEmail} · {f.userRole}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            f.type === "QUEJA" ? "destructive" : "secondary"
                          }
                          data-testid={`badge-feedback-type-${f.id}`}
                        >
                          {f.type === "QUEJA" ? "Queja" : "Sugerencia"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[240px]">
                        {f.subject}
                      </TableCell>
                      <TableCell className="text-sm whitespace-pre-wrap max-w-[360px]">
                        {f.message}
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


