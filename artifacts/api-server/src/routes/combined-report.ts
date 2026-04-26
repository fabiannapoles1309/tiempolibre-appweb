import { Router, type IRouter, type Response } from "express";
import { sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const PERIOD_TRUNC: Record<string, string> = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
};

const PERIOD_LABEL: Record<string, string> = {
  DAY: "Día",
  WEEK: "Semana",
  MONTH: "Mes",
  YEAR: "Año",
};

router.get(
  "/admin/reports/combined",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res: Response): Promise<void> => {
    const period = String(req.query.period ?? "MONTH").toUpperCase();
    const trunc = PERIOD_TRUNC[period];
    if (!trunc) {
      res
        .status(400)
        .json({ error: "Periodo inválido. Use DAY, WEEK, MONTH o YEAR." });
      return;
    }

    const fromRaw = req.query.from ? String(req.query.from) : null;
    const toRaw = req.query.to ? String(req.query.to) : null;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    function parseCalendarDate(raw: string): Date | null {
      if (!dateRe.test(raw)) return null;
      const [y, m, d] = raw.split("-").map((s) => Number(s));
      const dt = new Date(Date.UTC(y, m - 1, d));
      if (
        dt.getUTCFullYear() !== y ||
        dt.getUTCMonth() !== m - 1 ||
        dt.getUTCDate() !== d
      ) {
        return null;
      }
      return dt;
    }
    let fromDt: Date | null = null;
    let toDt: Date | null = null;
    if (fromRaw) {
      fromDt = parseCalendarDate(fromRaw);
      if (!fromDt) {
        res
          .status(400)
          .json({ error: "Parámetro 'from' debe ser una fecha YYYY-MM-DD válida." });
        return;
      }
    }
    if (toRaw) {
      toDt = parseCalendarDate(toRaw);
      if (!toDt) {
        res
          .status(400)
          .json({ error: "Parámetro 'to' debe ser una fecha YYYY-MM-DD válida." });
        return;
      }
    }
    if (fromDt && toDt && fromDt.getTime() > toDt.getTime()) {
      res
        .status(400)
        .json({ error: "El parámetro 'from' no puede ser posterior a 'to'." });
      return;
    }

    // Build the WHERE clause for the date range. Cancelled orders are excluded
    // from envíos / costo to keep the report consistent with what the cliente
    // actually pays for. Cash recibido only counts EFECTIVO orders that were
    // delivered (status = ENTREGADO).
    const whereParts: any[] = [sql`o.status <> 'CANCELADO'`];
    if (fromRaw) whereParts.push(sql`o.created_at >= ${fromRaw}::date`);
    if (toRaw)
      whereParts.push(sql`o.created_at < (${toRaw}::date + INTERVAL '1 day')`);
    const whereSql = sql.join(whereParts, sql` AND `);

    const rows = await db.execute(sql`
      SELECT
        date_trunc(${trunc}, o.created_at) AS bucket,
        c.id AS customer_id,
        u.name AS cliente_name,
        c.business_name AS business_name,
        COUNT(*)::int AS shipments,
        COALESCE(SUM(o.amount), 0)::numeric AS shipments_total,
        COALESCE(SUM(
          CASE
            WHEN o.payment = 'EFECTIVO' AND o.status = 'ENTREGADO'
              THEN o.cash_amount
            ELSE 0
          END
        ), 0)::numeric AS cash_total
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN users u ON u.id = c.user_id
      WHERE ${whereSql}
      GROUP BY bucket, c.id, u.name, c.business_name
      ORDER BY bucket DESC, u.name ASC
    `);

    const data = (rows.rows as any[]).map((r) => {
      const bucket: Date = new Date(r.bucket);
      const shipmentsTotal = Number(r.shipments_total ?? 0);
      const cashTotal = Number(r.cash_total ?? 0);
      return {
        bucket,
        customerId: Number(r.customer_id),
        clienteName: String(r.cliente_name ?? ""),
        businessName: r.business_name ? String(r.business_name) : "",
        shipments: Number(r.shipments ?? 0),
        shipmentsTotal,
        cashTotal,
        combined: shipmentsTotal + cashTotal,
      };
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reporte combinado");
    ws.columns = [
      { header: PERIOD_LABEL[period], key: "bucket", width: 18 },
      { header: "Cliente", key: "cliente", width: 28 },
      { header: "Establecimiento", key: "business", width: 28 },
      { header: "Envíos", key: "shipments", width: 10 },
      { header: "Costo total envíos (MXN)", key: "shipmentsTotal", width: 22 },
      { header: "Cash recibido (MXN)", key: "cashTotal", width: 22 },
      { header: "Total combinado (MXN)", key: "combined", width: 22 },
    ];

    function fmtBucket(d: Date): string {
      const iso = d.toISOString();
      if (period === "DAY") return iso.slice(0, 10);
      if (period === "WEEK") return `Semana del ${iso.slice(0, 10)}`;
      if (period === "MONTH") return iso.slice(0, 7);
      return iso.slice(0, 4);
    }

    let totShipments = 0;
    let totShipmentsAmt = 0;
    let totCash = 0;
    for (const r of data) {
      ws.addRow({
        bucket: fmtBucket(r.bucket),
        cliente: r.clienteName,
        business: r.businessName,
        shipments: r.shipments,
        shipmentsTotal: r.shipmentsTotal,
        cashTotal: r.cashTotal,
        combined: r.combined,
      });
      totShipments += r.shipments;
      totShipmentsAmt += r.shipmentsTotal;
      totCash += r.cashTotal;
    }

    if (data.length > 0) {
      const totalRow = ws.addRow({
        bucket: "TOTAL",
        cliente: "",
        business: "",
        shipments: totShipments,
        shipmentsTotal: totShipmentsAmt,
        cashTotal: totCash,
        combined: totShipmentsAmt + totCash,
      });
      totalRow.font = { bold: true };
    }

    // Format currency cells.
    ws.getColumn("shipmentsTotal").numFmt = '"$"#,##0.00';
    ws.getColumn("cashTotal").numFmt = '"$"#,##0.00';
    ws.getColumn("combined").numFmt = '"$"#,##0.00';
    ws.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="reporte-combinado-${period.toLowerCase()}.xlsx"`,
    );
    const buf = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  },
);

export default router;
