import { Router, type IRouter } from "express";
import { eq, desc, or } from "drizzle-orm";
import { db, feedbackTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { sendEmail } from "../services/emailService";
import { resolveAppUrl } from "../services/notificationService";
import { notifyByRole } from "../services/inAppNotifications";

const router: IRouter = Router();

const TYPES = new Set(["QUEJA", "SUGERENCIA"]);

router.post(
  "/me/feedback",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user!.sub;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const type = String(body.type ?? "").trim().toUpperCase();
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!TYPES.has(type)) {
      res
        .status(400)
        .json({ error: "Tipo inválido. Debe ser QUEJA o SUGERENCIA." });
      return;
    }
    if (subject.length < 1 || subject.length > 255) {
      res
        .status(400)
        .json({ error: "El asunto es requerido (máx 255 caracteres)." });
      return;
    }
    if (message.length < 1 || message.length > 4000) {
      res
        .status(400)
        .json({ error: "El mensaje es requerido (máx 4000 caracteres)." });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!user) {
      res.status(401).json({ error: "Sesión inválida." });
      return;
    }

    const [row] = await db
      .insert(feedbackTable)
      .values({ userId, type, subject, message })
      .returning();

    // Notify admins/superusers by email (non-blocking, never throws).
    (async () => {
      try {
        const admins = await db
          .select()
          .from(usersTable)
          .where(
            or(
              eq(usersTable.role, "ADMIN"),
              eq(usersTable.role, "SUPERUSER"),
            ),
          );
        const recipients = admins.map((a) => a.email).filter(Boolean);
        if (recipients.length === 0) return;
        const tag = type === "QUEJA" ? "Queja" : "Sugerencia";
        const appUrl = resolveAppUrl().replace(/\/+$/, "");
        await sendEmail({
          to: recipients,
          subject: `[${tag}] ${user.name}: ${subject}`,
          text: [
            `Nueva ${tag.toLowerCase()} recibida en TiempoLibre.`,
            "",
            `De: ${user.name} <${user.email}> (${user.role})`,
            `Asunto: ${subject}`,
            "",
            "Mensaje:",
            message,
            "",
            `Revísala en: ${appUrl}/admin/feedback`,
          ].join("\n"),
        });
      } catch (err) {
        console.error("[feedback] notify admins failed", err);
      }
    })();

    // Notificación in-app a admins/superusers (no depende de SMTP).
    const tag = type === "QUEJA" ? "Queja" : "Sugerencia";
    await notifyByRole(["ADMIN", "SUPERUSER"], {
      type: "FEEDBACK_NEW",
      title: `Nueva ${tag.toLowerCase()} de ${user.name}`,
      body: subject,
      link: "/admin/feedback",
    });

    res.status(201).json({
      id: row.id,
      type: row.type as "QUEJA" | "SUGERENCIA",
      subject: row.subject,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    });
  },
);

router.get(
  "/admin/feedback",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({
        id: feedbackTable.id,
        userId: feedbackTable.userId,
        type: feedbackTable.type,
        subject: feedbackTable.subject,
        message: feedbackTable.message,
        createdAt: feedbackTable.createdAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userRole: usersTable.role,
      })
      .from(feedbackTable)
      .leftJoin(usersTable, eq(usersTable.id, feedbackTable.userId))
      .orderBy(desc(feedbackTable.createdAt));

    res.json(
      rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName ?? "(usuario eliminado)",
        userEmail: r.userEmail ?? "",
        userRole: (r.userRole ?? "CLIENTE") as
          | "SUPERUSER"
          | "ADMIN"
          | "CLIENTE"
          | "DRIVER",
        type: r.type as "QUEJA" | "SUGERENCIA",
        subject: r.subject,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  },
);

export default router;
