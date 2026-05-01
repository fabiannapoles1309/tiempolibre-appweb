import { Router } from "express";
import { db } from "@workspace/db";

export const refundsRouter = Router();

// POST /api/admin/refunds
refundsRouter.post("/", async (req: any, res) => {
  try {
    const {
      orderId,
      clienteId,
      reason,           // "MERMA" | "ACCIDENTE" | "ROBO"
      percentage,       // 30 | 100
      insuranceRefund,  // true | false — devuelve también seguro de reparto
    } = req.body as {
      orderId:         number;
      clienteId:       number;
      reason:          "MERMA" | "ACCIDENTE" | "ROBO";
      percentage:      30 | 100;
      insuranceRefund: boolean;
    };

    // Obtener costo del pedido
    const order = await db.query.orders.findFirst({
      where: (o, { eq }) => eq(o.id, orderId),
    });
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });

    const shippingCost  = order.shippingCost     ?? 0;
    const insuranceCost = order.insuranceAmount   ?? 0;

    // Calcular monto a reembolsar
    let refundAmount = (shippingCost * percentage) / 100;
    if (insuranceRefund) refundAmount += insuranceCost;

    // Acreditar en billetera del cliente
    const existing = await db.query.wallets.findFirst({
      where: (w, { eq }) => eq(w.clienteId, clienteId),
    });

    if (existing) {
      await db
        .update(wallets)
        .set({ balance: existing.balance + refundAmount })
        .where(eq(wallets.clienteId, clienteId));
    } else {
      await db.insert(wallets).values({
        clienteId,
        balance: refundAmount,
      });
    }

    // Registrar el reembolso en historial
    await db.insert(refunds).values({
      orderId,
      clienteId,
      reason,
      percentage,
      amount:         refundAmount,
      insuranceRefund,
      appliedBy:      req.user?.id,
    });

    res.json({
      ok:           true,
      refundAmount,
      message:      `Se acreditaron $${refundAmount.toFixed(2)} a la billetera del cliente`,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al procesar reembolso" });
  }
});

// GET /api/admin/refunds — historial de reembolsos
refundsRouter.get("/", async (_req, res) => {
  try {
    const all = await db.query.refunds.findMany({
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      with: {
        order:   true,
        cliente: { with: { user: true } },
      },
    });
    res.json(all);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener reembolsos" });
  }
});

// GET /api/admin/clientes — lista de clientes para selector de reembolso
refundsRouter.get("/clientes", async (_req, res) => {
  try {
    const clientes = await db.query.clientes.findMany({
      with: { user: true },
      orderBy: (c, { asc }) => [asc(c.id)],
    });
    res.json(
      clientes.map((c) => ({
        id:           c.id,
        name:         c.user?.name ?? "Sin nombre",
        email:        c.user?.email ?? "",
        businessName: c.businessName ?? null,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});
