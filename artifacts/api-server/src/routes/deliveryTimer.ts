import { Router } from "express";
import { db } from "../db";
import { sendToAdmins, APP_URL } from "../utils/mailer";

export const deliveryTimerRouter = Router();

// POST /api/orders/:id/start-route
// Llama esto cuando el driver presiona "Salir a ruta"
deliveryTimerRouter.post("/:id/start-route", async (req: any, res) => {
  try {
    const orderId = Number(req.params.id);

    // Marcar hora de inicio en la orden
    await db
      .update(orders)
      .set({ routeStartedAt: new Date(), status: "EN_RUTA" })
      .where(eq(orders.id, orderId));

    const order = await db.query.orders.findFirst({
      where: (o, { eq }) => eq(o.id, orderId),
      with: { driver: { with: { user: true } } },
    });

    const driverName = order?.driver?.user?.name ?? "Sin nombre";

    // ── Alerta a los 40 minutos ──────────────────────────────
    setTimeout(async () => {
      const current = await db.query.orders.findFirst({
        where: (o, { eq }) => eq(o.id, orderId),
      });

      // Solo alertar si sigue EN_RUTA (no entregado aún)
      if (current?.status === "EN_RUTA") {
        // Guardar alerta en BD para mostrar en panel
        await db.insert(deliveryAlerts).values({
          orderId,
          type:    "RETRASO_40MIN",
          message: `Pedido #${orderId} lleva más de 40 min en ruta — Driver: ${driverName}`,
        });

        // Enviar correo a admin y superadmin
        await sendToAdmins(
          `⚠️ Alerta de retraso — Pedido #${orderId}`,
          `
          <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;
                      border:1px solid #fbbf24;border-radius:12px;background:#fffbeb">
            <h2 style="color:#d97706;margin-bottom:8px">⚠️ Posible retraso en entrega</h2>
            <p><b>Pedido:</b> #${orderId}</p>
            <p><b>Driver:</b> ${driverName}</p>
            <p style="color:#6b7280">
              Han transcurrido <b>40 minutos</b> desde que el driver salió a ruta
              y el pedido aún no ha sido marcado como entregado.
            </p>
            <a href="${APP_URL}/admin/orders/${orderId}"
               style="display:inline-block;margin-top:20px;padding:12px 28px;
                      background:#d97706;color:#fff;border-radius:8px;
                      text-decoration:none;font-weight:bold">
              Ver pedido →
            </a>
          </div>`
        );
      }
    }, 40 * 60 * 1000); // 40 minutos exactos

    res.json({ ok: true, routeStartedAt: new Date() });
  } catch (e) {
    res.status(500).json({ error: "Error al iniciar ruta" });
  }
});

// GET /api/admin/alerts — panel admin consulta alertas activas
deliveryTimerRouter.get("/alerts", async (_req, res) => {
  try {
    const alerts = await db.query.deliveryAlerts.findMany({
      where: (a, { isNull }) => isNull(a.resolvedAt),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
      with: { order: true },
    });
    res.json(alerts);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener alertas" });
  }
});

// PATCH /api/admin/alerts/:id/resolve — marcar alerta como resuelta
deliveryTimerRouter.patch("/alerts/:id/resolve", async (req, res) => {
  try {
    await db
      .update(deliveryAlerts)
      .set({ resolvedAt: new Date() })
      .where(eq(deliveryAlerts.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Error al resolver alerta" });
  }
});
