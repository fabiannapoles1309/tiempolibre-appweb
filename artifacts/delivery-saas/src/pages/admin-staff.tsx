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
import { ShieldCheck, Mail } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type StaffUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "SUPERUSER";
  createdAt: string;
};

export default function AdminStaffPage() {
  const { data = [], isLoading } = useQuery<StaffUser[]>({
    queryKey: ["admin-staff-users"],
    queryFn: async () => {
      const r = await apiFetch("/api/admin/staff-users", {
        credentials: "include",
      });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-[#00B5E2]" /> Personal interno
        </h1>
        <p className="text-muted-foreground mt-1">
          Administradores y soporte (SUPERUSER) de TiempoLibre. Estos correos
          reciben las notificaciones de solicitudes de paquetes y de quejas /
          sugerencias enviadas por los clientes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#00B5E2]" />
            Directorio
          </CardTitle>
          <CardDescription>
            {data.length} {data.length === 1 ? "cuenta" : "cuentas"} con
            permisos administrativos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo electrónico</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-8"
                    >
                      No hay administradores registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((u) => (
                    <TableRow key={u.id} data-testid={`row-staff-${u.id}`}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell data-testid={`text-staff-email-${u.id}`}>
                        <a
                          href={`mailto:${u.email}`}
                          className="text-[#00B5E2] hover:underline"
                        >
                          {u.email}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.role === "SUPERUSER" ? "default" : "secondary"
                          }
                        >
                          {u.role === "SUPERUSER" ? "Soporte" : "Admin"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(u.createdAt), "dd MMM yyyy", {
                          locale: es,
                        })}
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
