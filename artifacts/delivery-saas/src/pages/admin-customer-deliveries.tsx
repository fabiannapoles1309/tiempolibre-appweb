import { useAdminCustomerDeliveries } from "@workspace/api-client-react";
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
import { BarChart3, AlertTriangle } from "lucide-react";

export default function AdminCustomerDeliveriesPage() {
  const { data, isLoading } = useAdminCustomerDeliveries();
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-[#00B5E2]" /> Envíos por cliente
        </h1>
        <p className="text-muted-foreground mt-1">
          Estado del consumo de cada cliente y envíos restantes en su plan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clientes ({rows.length})</CardTitle>
          <CardDescription>
            Los que tienen 5 envíos o menos aparecen marcados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No hay clientes registrados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Usados</TableHead>
                  <TableHead className="text-right">Mensuales</TableHead>
                  <TableHead className="text-right">Restantes</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const low =
                    r.tier != null &&
                    r.remainingDeliveries <= 5 &&
                    r.status === "ACTIVA";
                  return (
                    <TableRow key={r.customerId} data-testid={`row-customer-${r.customerId}`}>
                      <TableCell className="font-medium">{r.customerName}</TableCell>
                      <TableCell>
                        {r.tier ? (
                          <Badge variant="secondary">{r.tier}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin plan</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.usedDeliveries}</TableCell>
                      <TableCell className="text-right">{r.monthlyDeliveries}</TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          low ? "text-red-600" : ""
                        }`}
                      >
                        {r.remainingDeliveries}
                      </TableCell>
                      <TableCell>
                        {r.status === "ACTIVA" ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                            Activa
                          </Badge>
                        ) : r.status ? (
                          <Badge variant="outline">{r.status}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">â€”</span>
                        )}
                        {low && (
                          <span className="ml-2 inline-flex items-center text-xs text-red-600">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Bajo
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



