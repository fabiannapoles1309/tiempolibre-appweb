import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  db,
  recipientsTable,
  customersTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import ExcelJS from "exceljs";

const router: IRouter = Router();

/**
 * Directorio de destinatarios del CLIENTE autenticado. Se usa para
 * autollenado en /orders/new (búsqueda por teléfono o por nombre).
 */
router.get(
  "/me/recipients",
  requireAuth,
  requireRole("CLIENTE"),
  async (req, res): Promise<void> => {
    const [me] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.userId, req.user!.sub));
    if (!me) {
      res.json([]);
      return;
    }
    const q = (req.query.q as string | undefined)?.trim();
    const where = q
      ? and(
          eq(recipientsTable.customerId, me.id),
          or(
            ilike(recipientsTable.name, `%${q}%`),
            ilike(recipientsTable.phone, `%${q}%`),
          ),
        )
      : eq(recipientsTable.customerId, me.id);

    const rows = await db
      .select()
      .from(recipientsTable)
      .where(where)
      .orderBy(desc(recipientsTable.lastUsedAt))
      .limit(50);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        allowMarketingSms: r.allowMarketingSms,
        allowMarketingEmail: r.allowMarketingEmail,
        orderCount: r.orderCount,
        lastUsedAt: r.lastUsedAt.toISOString(),
      })),
    );
  },
);

async function listAdminRows(q?: string) {
  const where = q
    ? or(
        ilike(recipientsTable.name, `%${q}%`),
        ilike(recipientsTable.phone, `%${q}%`),
        ilike(customersTable.businessName, `%${q}%`),
        ilike(usersTable.name, `%${q}%`),
      )
    : undefined;
  const rows = await db
    .select({
      id: recipientsTable.id,
      name: recipientsTable.name,
      phone: recipientsTable.phone,
      email: recipientsTable.email,
      allowMarketingSms: recipientsTable.allowMarketingSms,
      allowMarketingEmail: recipientsTable.allowMarketingEmail,
      orderCount: recipientsTable.orderCount,
      lastUsedAt: recipientsTable.lastUsedAt,
      createdAt: recipientsTable.createdAt,
      customerId: recipientsTable.customerId,
      businessName: customersTable.businessName,
      clienteName: usersTable.name,
      clienteEmail: usersTable.email,
    })
    .from(recipientsTable)
    .innerJoin(
      customersTable,
      eq(customersTable.id, recipientsTable.customerId),
    )
    .innerJoin(usersTable, eq(usersTable.id, customersTable.userId))
    .where(where as any)
    .orderBy(desc(recipientsTable.lastUsedAt))
    .limit(1000);
  return rows;
}

router.get(
  "/admin/recipients",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const q = (req.query.q as string | undefined)?.trim();
    const rows = await listAdminRows(q);
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        allowMarketingSms: r.allowMarketingSms,
        allowMarketingEmail: r.allowMarketingEmail,
        orderCount: r.orderCount,
        lastUsedAt: r.lastUsedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        cliente: {
          customerId: r.customerId,
          businessName: r.businessName,
          name: r.clienteName,
          email: r.clienteEmail,
        },
      })),
    );
  },
);

router.get(
  "/admin/recipients/export",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (_req, res: Response): Promise<void> => {
    const rows = await listAdminRows();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Destinatarios");
    ws.columns = [
      { header: "Cliente", key: "cliente", width: 28 },
      { header: "Establecimiento", key: "businessName", width: 28 },
      { header: "Email cliente", key: "email", width: 28 },
      { header: "Destinatario", key: "name", width: 28 },
      { header: "Teléfono", key: "phone", width: 18 },
      { header: "Correo destinatario", key: "recipientEmail", width: 28 },
      { header: "SMS publicidad", key: "sms", width: 16 },
      { header: "Email publicidad", key: "email_pub", width: 16 },
      { header: "Envíos", key: "orderCount", width: 10 },
      { header: "Último envío", key: "lastUsedAt", width: 22 },
    ];
    for (const r of rows) {
      ws.addRow({
        cliente: r.clienteName,
        businessName: r.businessName ?? "",
        email: r.clienteEmail,
        name: r.name,
        phone: r.phone,
        recipientEmail: r.email ?? "",
        sms: r.allowMarketingSms ? "Sí" : "No",
        email_pub: r.allowMarketingEmail ? "Sí" : "No",
        orderCount: r.orderCount,
        lastUsedAt: r.lastUsedAt.toISOString().slice(0, 19).replace("T", " "),
      });
    }
    ws.getRow(1).font = { bold: true };
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="destinatarios.xlsx"`,
    );
    const buf = await wb.xlsx.writeBuffer();
    res.send(Buffer.from(buf));
  },
);

export default router;
