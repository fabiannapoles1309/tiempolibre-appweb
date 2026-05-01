import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import ExcelJS from "exceljs";
import {
  db,
  ordersTable,
  subscriptionsTable,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

type Period = "day" | "week" | "month" | "year";

function periodRange(period: Period): { start: Date; end: Date; label: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "week") {
    start.setDate(start.getDate() - 6);
  } else if (period === "month") {
    start.setDate(1);
  } else if (period === "year") {
    start.setMonth(0, 1);
  }
  const label =
    period === "day" ? "Día" : period === "week" ? "Semana" : period === "month" ? "Mes" : "Año";
  return { start, end, label };
}

function formatMoneyMx(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

router.get(
  "/finance/export/excel",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const type = String(req.query.type ?? "").toLowerCase();
    const period = String(req.query.period ?? "").toLowerCase() as Period;
    const clienteIdRaw = req.query.clienteId;
    const clienteId =
      clienteIdRaw !== undefined && clienteIdRaw !== null && clienteIdRaw !== ""
        ? Number(clienteIdRaw)
        : null;

    if (!["deliveries", "plans", "accounting"].includes(type)) {
      res.status(400).json({ error: "type debe ser deliveries|plans|accounting" });
      return;
    }
    if (!["day", "week", "month", "year"].includes(period)) {
      res.status(400).json({ error: "period debe ser day|week|month|year" });
      return;
    }
    if (clienteId !== null && !Number.isFinite(clienteId)) {
      res.status(400).json({ error: "clienteId inválido" });
      return;
    }

    const { start, end, label } = periodRange(period);

    const wb = new ExcelJS.Workbook();
    wb.creator = "TiempoLibre";
    wb.created = new Date();

    if (type === "deliveries") {
      const conds = [
        eq(ordersTable.status, "ENTREGADO"),
        gte(ordersTable.createdAt, start),
        lte(ordersTable.createdAt, end),
      ];
      if (clienteId !== null) conds.push(eq(ordersTable.customerId, clienteId));
      const rows = await db
        .select({
          id: ordersTable.id,
          createdAt: ordersTable.createdAt,
          customerId: ordersTable.customerId,
          customerName: usersTable.name,
          zone: ordersTable.zone,
          payment: ordersTable.payment,
          amount: ordersTable.amount,
          delivery: ordersTable.delivery,
        })
        .from(ordersTable)
        .leftJoin(usersTable, eq(usersTable.id, ordersTable.customerId))
        .where(and(...conds))
        .orderBy(desc(ordersTable.createdAt));

      const ws = wb.addWorksheet("Entregas");
      ws.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Envío #", key: "id", width: 10 },
        { header: "Cliente", key: "cliente", width: 28 },
        { header: "Zona", key: "zona", width: 8 },
        { header: "Método", key: "payment", width: 14 },
        { header: "Importe", key: "amount", width: 14 },
        { header: "Dirección", key: "delivery", width: 40 },
      ];
      ws.getRow(1).font = { bold: true };
      let total = 0;
      for (const r of rows) {
        ws.addRow({
          fecha: r.createdAt.toISOString().slice(0, 19).replace("T", " "),
          id: r.id,
          cliente: r.customerName ?? "â€”",
          zona: r.zone ?? "â€”",
          payment: r.payment,
          amount: Number(r.amount),
          delivery: r.delivery,
        });
        total += Number(r.amount);
      }
      const totalRow = ws.addRow({
        cliente: "TOTAL",
        amount: total,
      });
      totalRow.font = { bold: true };
      ws.getColumn("amount").numFmt = '"$"#,##0.00';
    } else if (type === "plans") {
      const conds = [
        gte(subscriptionsTable.createdAt, start),
        lte(subscriptionsTable.createdAt, end),
      ];
      if (clienteId !== null) conds.push(eq(subscriptionsTable.userId, clienteId));
      const rows = await db
        .select({
          id: subscriptionsTable.id,
          createdAt: subscriptionsTable.createdAt,
          userId: subscriptionsTable.userId,
          userName: usersTable.name,
          tier: subscriptionsTable.tier,
          monthlyPrice: subscriptionsTable.monthlyPrice,
          monthlyDeliveries: subscriptionsTable.monthlyDeliveries,
          status: subscriptionsTable.status,
        })
        .from(subscriptionsTable)
        .leftJoin(usersTable, eq(usersTable.id, subscriptionsTable.userId))
        .where(and(...conds))
        .orderBy(desc(subscriptionsTable.createdAt));

      const ws = wb.addWorksheet("Planes");
      ws.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Sub #", key: "id", width: 10 },
        { header: "Cliente", key: "cliente", width: 28 },
        { header: "Plan", key: "tier", width: 12 },
        { header: "Envíos del bloque", key: "monthly", width: 18 },
        { header: "Precio", key: "price", width: 14 },
        { header: "Estatus", key: "status", width: 14 },
      ];
      ws.getRow(1).font = { bold: true };
      let total = 0;
      for (const r of rows) {
        ws.addRow({
          fecha: r.createdAt.toISOString().slice(0, 19).replace("T", " "),
          id: r.id,
          cliente: r.userName ?? "â€”",
          tier: r.tier,
          monthly: r.monthlyDeliveries,
          price: Number(r.monthlyPrice),
          status: r.status,
        });
        total += Number(r.monthlyPrice);
      }
      const totalRow = ws.addRow({ cliente: "TOTAL", price: total });
      totalRow.font = { bold: true };
      ws.getColumn("price").numFmt = '"$"#,##0.00';
    } else {
      // accounting: ingresos vs gastos del período (a partir de transactionsTable)
      // Si se filtra por cliente, sólo se incluyen transacciones cuyo orderId
      // pertenezca a un envío de ese cliente.
      let allowedOrderIds: Set<number> | null = null;
      if (clienteId !== null) {
        const ordersForCliente = await db
          .select({ id: ordersTable.id })
          .from(ordersTable)
          .where(eq(ordersTable.customerId, clienteId));
        allowedOrderIds = new Set(ordersForCliente.map((o) => o.id));
      }

      const txsAll = await db
        .select()
        .from(transactionsTable)
        .where(
          and(
            gte(transactionsTable.createdAt, start),
            lte(transactionsTable.createdAt, end),
          ),
        )
        .orderBy(desc(transactionsTable.createdAt));
      const txs = allowedOrderIds
        ? txsAll.filter((t) => t.orderId !== null && allowedOrderIds!.has(t.orderId))
        : txsAll;

      // Resumen general (hoja 1) ----------------------------------------
      let income = 0;
      let expense = 0;

      // Desglose por método (hoja 2) â€” incluye los 5 métodos vigentes
      // (EFECTIVO, TRANSFERENCIA, BILLETERA, TARJETA, CORTESIA) aunque no
      // tengan transacciones, para que el contador siempre vea las columnas.
      const ALL_METHODS = [
        "EFECTIVO",
        "TRANSFERENCIA",
        "BILLETERA",
        "TARJETA",
        "CORTESIA",
      ] as const;
      const methodTotals = new Map<
        string,
        { ingresos: number; gastos: number; servicios: number }
      >();
      for (const m of ALL_METHODS) {
        methodTotals.set(m, { ingresos: 0, gastos: 0, servicios: 0 });
      }

      for (const t of txs) {
        const amt = Number(t.amount);
        if (t.type === "INGRESO") income += amt;
        else expense += amt;
        const key = methodTotals.has(t.method) ? t.method : "OTRO";
        if (!methodTotals.has(key)) {
          methodTotals.set(key, { ingresos: 0, gastos: 0, servicios: 0 });
        }
        const bucket = methodTotals.get(key)!;
        if (t.type === "INGRESO") bucket.ingresos += amt;
        else bucket.gastos += amt;
        if (t.orderId !== null) bucket.servicios += 1;
      }

      // Hoja 1: Resumen contable
      const front = wb.addWorksheet("Resumen contable");
      front.columns = [
        { header: "Concepto", key: "concept", width: 32 },
        { header: "Monto", key: "amount", width: 18 },
      ];
      front.getRow(1).font = { bold: true };
      front.addRow({ concept: `Ingresos (${label})`, amount: income });
      front.addRow({ concept: `Gastos (${label})`, amount: expense });
      const netRow = front.addRow({
        concept: "Resultado neto",
        amount: income - expense,
      });
      netRow.font = { bold: true };
      front.getColumn("amount").numFmt = '"$"#,##0.00';
      front.addRow({});
      front.addRow({ concept: "Generado", amount: new Date().toISOString() });

      // Hoja 2: Desglose por método de pago â€” pedido explícito por contabilidad
      const breakdown = wb.addWorksheet("Por método de pago");
      breakdown.columns = [
        { header: "Método", key: "method", width: 18 },
        { header: "Servicios", key: "servicios", width: 14 },
        { header: "Ingresos", key: "ingresos", width: 16 },
        { header: "Gastos", key: "gastos", width: 16 },
        { header: "Neto", key: "neto", width: 16 },
      ];
      breakdown.getRow(1).font = { bold: true };
      let tIng = 0;
      let tGas = 0;
      let tSrv = 0;
      for (const [method, v] of methodTotals.entries()) {
        breakdown.addRow({
          method,
          servicios: v.servicios,
          ingresos: v.ingresos,
          gastos: v.gastos,
          neto: v.ingresos - v.gastos,
        });
        tIng += v.ingresos;
        tGas += v.gastos;
        tSrv += v.servicios;
      }
      const totalRow = breakdown.addRow({
        method: "TOTAL",
        servicios: tSrv,
        ingresos: tIng,
        gastos: tGas,
        neto: tIng - tGas,
      });
      totalRow.font = { bold: true };
      breakdown.getColumn("ingresos").numFmt = '"$"#,##0.00';
      breakdown.getColumn("gastos").numFmt = '"$"#,##0.00';
      breakdown.getColumn("neto").numFmt = '"$"#,##0.00';

      // Hoja 3: Detalle de transacciones
      const ws = wb.addWorksheet("Detalle");
      ws.columns = [
        { header: "Fecha", key: "fecha", width: 20 },
        { header: "Tipo", key: "type", width: 12 },
        { header: "Descripción", key: "desc", width: 40 },
        { header: "Método", key: "method", width: 14 },
        { header: "Monto", key: "amount", width: 14 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const t of txs) {
        ws.addRow({
          fecha: t.createdAt.toISOString().slice(0, 19).replace("T", " "),
          type: t.type,
          desc: t.description,
          method: t.method,
          amount: Number(t.amount),
        });
      }
      ws.getColumn("amount").numFmt = '"$"#,##0.00';

      void formatMoneyMx; // referencia para evitar warning si no se usa
    }

    const filename = `tiempolibre_${type}_${period}_${start.toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    // Stream binario directo para evitar "Formato o extensión no válidos" al abrir.
    await wb.xlsx.write(res);
    res.end();
  },
);

export default router;
