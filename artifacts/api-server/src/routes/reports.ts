import { Router } from "express";
import { db } from "../db";
import ExcelJS from "exceljs";

export const reportsRouter = Router();

// GET /api/admin/reports/deliveries?clienteId=&from=&to=
reportsRouter.get("/deliveries", async (req: any, res) => {
  try {
    const { clienteId, from, to } = req.query;
    const role = req.user?.role;

    const orders = await db.query.orders.findMany({
      where: (o, { eq, and, gte, lte }) =>
        and(
          role === "CLIENT" ? eq(o.clienteId, req.user?.clienteId) :
          clienteId ? eq(o.clienteId, Number(clienteId)) : undefined,
          from ? gte(o.createdAt, new Date(from as string)) : undefined,
          to   ? lte(o.createdAt, new Date(to   as string)) : undefined,
        ),
      with: {
        cliente: { with: { user: true } },
        driver:  { with: { user: true } },
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    });

    res.json(
      orders.map((o) => ({
        id:             o.id,
        cliente:        o.cliente?.user?.name ?? "",
        clienteEmail:   o.cliente?.user?.email ?? "",
        driver:         o.driver?.user?.name ?? "",
        status:         o.status,
        createdAt:      o.createdAt,
        routeStartedAt: o.routeStartedAt,
        deliveredAt:    o.deliveredAt,
        minutesInRoute: o.routeStartedAt && o.deliveredAt
          ? Math.round(
              (new Date(o.deliveredAt).getTime() -
               new Date(o.routeStartedAt).getTime()) / 60000
            )
          : null,
        shippingCost:   o.shippingCost   ?? 0,
        paymentMethod:  o.paymentMethod  ?? "",
        cardAmount:     o.cardAmount     ?? 0,
        transferAmount: o.transferAmount ?? 0,
        cashAmount:     o.cashAmount     ?? 0,
        insuranceAmount:o.insuranceAmount?? 0,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: "Error al obtener reporte" });
  }
});

// GET /api/admin/reports/excel?from=&to= — descarga Excel completo
reportsRouter.get("/excel", async (req: any, res) => {
  try {
    const { from, to, clienteId } = req.query;

    const orders = await db.query.orders.findMany({
      where: (o, { and, gte, lte, eq }) =>
        and(
          clienteId ? eq(o.clienteId, Number(clienteId)) : undefined,
          from ? gte(o.createdAt, new Date(from as string)) : undefined,
          to   ? lte(o.createdAt, new Date(to   as string)) : undefined,
        ),
      with: {
        cliente: { with: { user: true } },
        driver:  { with: { user: true } },
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "TiempoLibre";

    // ── Hoja 1: Detalle de envíos ──────────────────────────────
    const ws1 = wb.addWorksheet("Detalle de Envíos");
    ws1.columns = [
      { header: "ID Pedido",        key: "id",              width: 10 },
      { header: "Cliente",          key: "cliente",         width: 25 },
      { header: "Email Cliente",    key: "clienteEmail",    width: 28 },
      { header: "Driver",           key: "driver",          width: 22 },
      { header: "Estado",           key: "status",          width: 14 },
      { header: "Fecha",            key: "fecha",           width: 18 },
      { header: "Minutos en Ruta",  key: "minutos",         width: 16 },
      { header: "Costo Envío",      key: "shippingCost",    width: 14 },
      { header: "Método Pago",      key: "paymentMethod",   width: 16 },
      { header: "Monto Efectivo",   key: "cashAmount",      width: 16 },
      { header: "Monto Tarjeta",    key: "cardAmount",      width: 16 },
      { header: "Monto Transf.",    key: "transferAmount",  width: 16 },
      { header: "Seguro Reparto",   key: "insuranceAmount", width: 16 },
    ];

    // Estilo de encabezado
    ws1.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid",
                    fgColor: { argb: "FF00B5E2" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center" };
    });

    orders.forEach((o) => {
      ws1.addRow({
        id:             o.id,
        cliente:        o.cliente?.user?.name  ?? "",
        clienteEmail:   o.cliente?.user?.email ?? "",
        driver:         o.driver?.user?.name   ?? "",
        status:         o.status,
        fecha:          o.createdAt ? new Date(o.createdAt).toLocaleString("es-MX") : "",
        minutos:        o.routeStartedAt && o.deliveredAt
                          ? Math.round(
                              (new Date(o.deliveredAt).getTime() -
                               new Date(o.routeStartedAt).getTime()) / 60000
                            )
                          : "",
        shippingCost:   o.shippingCost    ?? 0,
        paymentMethod:  o.paymentMethod   ?? "",
        cashAmount:     o.cashAmount      ?? 0,
        cardAmount:     o.cardAmount      ?? 0,
        transferAmount: o.transferAmount  ?? 0,
        insuranceAmount:o.insuranceAmount ?? 0,
      });
    });

    // ── Hoja 2: Resumen por método de pago ────────────────────
    const ws2 = wb.addWorksheet("Resumen Recaudación");
    ws2.columns = [
      { header: "Método de Pago", key: "method",  width: 20 },
      { header: "Total",          key: "total",   width: 16 },
      { header: "# Pedidos",      key: "count",   width: 12 },
    ];
    ws2.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid",
                    fgColor: { argb: "FF00B5E2" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    });

    const summary = {
      EFECTIVO:      { total: 0, count: 0 },
      TARJETA:       { total: 0, count: 0 },
      TRANSFERENCIA: { total: 0, count: 0 },
    };
    orders.forEach((o) => {
      const m = (o.paymentMethod ?? "EFECTIVO") as keyof typeof summary;
      if (summary[m]) {
        summary[m].total += o.shippingCost ?? 0;
        summary[m].count += 1;
      }
    });
    Object.entries(summary).forEach(([method, { total, count }]) => {
      ws2.addRow({ method, total, count });
    });

    // Enviar como descarga
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reporte-tiempolibre-${Date.now()}.xlsx`
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al generar Excel" });
  }
});
