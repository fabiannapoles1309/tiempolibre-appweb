﻿import { useAdminCashByCustomer } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote } from "lucide-react";

const formatMoney = (val: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

export default function AdminCashByCustomerPage() {
  const { data, isLoading } = useAdminCashByCustomer();
  const rows = data ?? [];
  const total = rows.reduce((acc, r) => acc + Number(r.cashPending), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Banknote className="w-7 h-7 text-[#00B5E2]" /> Cash por cliente
        </h1>
        <p className="text-muted-foreground mt-1">
          Efectivo cobrado por pedidos entregados, agrupado por cliente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendiente por cliente ({rows.length})</CardTitle>
          <CardDescription>
            Total acumulado:{" "}
            <span className="font-bold text-foreground">{formatMoney(total)}</span>
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
              No hay efectivo registrado por clientes.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Pedidos en efectivo</TableHead>
                  <TableHead className="text-right">Total cobrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.customerId}>
                    <TableCell className="font-medium">{r.customerName}</TableCell>
                    <TableCell className="text-right">{r.ordersCount}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoney(Number(r.cashPending))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


