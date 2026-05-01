import { Router } from "express";
import { db } from "@workspace/db";

export const messagingRouter = Router();

// GET /api/admin/messaging/drivers — lista de drivers para selector
messagingRouter.get("/drivers", async (_req, res) => {
  try {
    const drivers = await db.query.drivers.findMany({
      with: { user: true },
      orderBy: (d, { asc }) => [asc(d.id)],
    });
    res.json(
      drivers.map((d) => ({
        id:    d.userId,
        name:  d.user?.name  ?? "Sin nombre",
        email: d.user?.email ?? "",
      }))
    );
  } catch (e) {
    res.status(500).json({ error: "Error al obtener drivers" });
  }
});

// GET /api/admin/messaging/clientes — lista de clientes para selector
messagingRouter.get("/clientes", async (_req, res) => {
  try {
    const clientes = await db.query.clientes.findMany({
      with: { user: true },
      orderBy: (c, { asc }) => [asc(c.id)],
    });
    res.json(
      clientes.map((c) => ({
        id:    c.userId,
        name:  c.user?.name  ?? "Sin nombre",
        email: c.user?.email ?? "",
      }))
    );
  } catch (e) {
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

// POST /api/admin/messaging/send — enviar mensaje
messagingRouter.post("/send", async (req: any, res) => {
  try {
    const {
      recipientType, // "DRIVER" | "CLIENT"
      recipientId,   // number | null = todos
      message,
    } = req.body as {
      recipientType: "DRIVER" | "CLIENT";
      recipientId:   number | null;
      message:       string;
    };

    const senderId = req.user?.id;

    if (recipientId) {
      // Mensaje individual
      await db.insert(adminMessages).values({
        senderId,
        recipientType,
        recipientId,
        message,
      });
      return res.json({ ok: true, sent: 1 });
    }

    // Mensaje masivo — obtener todos los destinatarios
    const targets =
      recipientType === "DRIVER"
        ? await db.query.drivers.findMany({ columns: { userId: true } })
        : await db.query.clientes.findMany({ columns: { userId: true } });

    await Promise.all(
      targets.map((t) =>
        db.insert(adminMessages).values({
          senderId,
          recipientType,
          recipientId: t.userId,
          message,
        })
      )
    );

    res.json({ ok: true, sent: targets.length });
  } catch (e) {
    res.status(500).json({ error: "Error al enviar mensaje" });
  }
});

// GET /api/admin/messaging/history?type=DRIVER&recipientId=5
messagingRouter.get("/history", async (req, res) => {
  try {
    const { type, recipientId } = req.query;
    const msgs = await db.query.adminMessages.findMany({
      where: (m, { eq, and }) =>
        and(
          eq(m.recipientType, type as string),
          recipientId ? eq(m.recipientId, Number(recipientId)) : undefined
        ),
      orderBy: (m, { desc }) => [desc(m.createdAt)],
      take: 100,
    });
    res.json(msgs);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// GET /api/driver/messages — driver lee sus mensajes
messagingRouter.get("/my-messages", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const msgs = await db.query.adminMessages.findMany({
      where: (m, { eq }) => eq(m.recipientId, userId),
      orderBy: (m, { desc }) => [desc(m.createdAt)],
    });
    res.json(msgs);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener mensajes" });
  }
});
