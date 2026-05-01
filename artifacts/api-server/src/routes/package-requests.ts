import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  db,
  packageRequestsTable,
  customersTable,
  usersTable,
  subscriptionsTable,
  walletsTable,
  walletTxTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  notifyAdminsPackageRequest,
  resolveAppUrl,
} from "../services/notificationService";
import { notifyByRole, notifyUsers } from "../services/inAppNotifications";
import { getPricing } from "./pricing-settings";

const router: IRouter = Router();
const RECHARGE_BLOCK = 35;

/**
 * Solicita un nuevo paquete de entregas (+35). Genera una solicitud
 * PENDIENTE y notifica a ADMIN/SUPERUSER por correo (best-effort â€”
 * registrado en log si no hay servicio SMTP configurado).
 */
router.post(
  "/me/package-requests",
  requireAuth,
  requireRole("CLIENTE"),
  async (req, res): Promise<void> => {
    const [me] = await db
      .select({
        id: customersTable.id,
        businessName: customersTable.businessName,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(customersTable)
      .innerJoin(usersTable, eq(usersTable.id, customersTable.userId))
      .where(eq(customersTable.userId, req.user!.sub));
    if (!me) {
      res.status(404).json({ error: "Tu cuenta no tiene perfil de cliente." });
      return;
    }

    // El índice único parcial `package_requests_one_pending_per_user`
    // garantiza una sola PENDIENTE por usuario incluso bajo concurrencia.
    // Cualquier inserción concurrente se traduce en un error 23505 que
    // mapeamos a HTTP 409 para evitar duplicados silenciosos.
    let created: typeof packageRequestsTable.$inferSelect | undefined;
    try {
      [created] = await db
        .insert(packageRequestsTable)
        .values({
          userId: req.user!.sub,
          customerId: me.id,
          status: "PENDIENTE",
        })
        .returning();
    } catch (err: any) {
      // Drizzle puede envolver el PgError en `.cause`; chequeamos ambos
      // niveles para detectar la violación de UNIQUE (23505) y mapearla
      // a un 409 limpio en vez de un 500 genérico.
      const pgCode =
        err?.code ??
        err?.cause?.code ??
        err?.original?.code;
      if (pgCode === "23505") {
        const [existing] = await db
          .select()
          .from(packageRequestsTable)
          .where(
            and(
              eq(packageRequestsTable.userId, req.user!.sub),
              eq(packageRequestsTable.status, "PENDIENTE"),
            ),
          );
        res.status(409).json({
          error:
            "Ya tienes una solicitud pendiente. Espera a que el equipo la apruebe.",
          reason: "PENDING_REQUEST_EXISTS",
          request: existing
            ? {
                id: existing.id,
                status: existing.status,
                requestedAt: existing.requestedAt.toISOString(),
              }
            : null,
        });
        return;
      }
      throw err;
    }

    // Notificación a admins/superusers (best-effort).
    try {
      const admins = await db
        .select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(inArray(usersTable.role, ["ADMIN", "SUPERUSER"]));
      await notifyAdminsPackageRequest({
        admins,
        cliente: {
          name: me.userName,
          email: me.userEmail,
          businessName: me.businessName ?? null,
        },
        requestId: created!.id,
        appUrl: resolveAppUrl(),
      });
    } catch (err) {
      console.error("notifyAdminsPackageRequest failed", err);
    }

    // Notificación in-app a admins/superusers â€” esto sí funciona aunque
    // no haya proveedor de email configurado, así que es la principal vía
    // de aviso para que el admin actúe sobre la solicitud.
    await notifyByRole(["ADMIN", "SUPERUSER"], {
      type: "PACKAGE_REQUEST_NEW",
      title: `Nueva solicitud de paquete extra (+35)`,
      body: `${me.businessName ?? me.userName} solicitó un paquete adicional. Revisa y aprueba o rechaza.`,
      link: "/admin/solicitudes-paquetes",
    });

    res.status(201).json({
      id: created!.id,
      status: created!.status,
      requestedAt: created!.requestedAt.toISOString(),
    });
  },
);

/**
 * Devuelve la solicitud pendiente del cliente, si existe. La UI de la
 * billetera la usa para decidir si muestra el botón habilitado o un
 * estado "En revisión".
 */
router.get(
  "/me/package-requests/active",
  requireAuth,
  requireRole("CLIENTE"),
  async (req, res): Promise<void> => {
    const [pending] = await db
      .select()
      .from(packageRequestsTable)
      .where(
        and(
          eq(packageRequestsTable.userId, req.user!.sub),
          eq(packageRequestsTable.status, "PENDIENTE"),
        ),
      )
      .orderBy(desc(packageRequestsTable.requestedAt));
    if (!pending) {
      res.json({ pending: null });
      return;
    }
    res.json({
      pending: {
        id: pending.id,
        status: pending.status,
        requestedAt: pending.requestedAt.toISOString(),
      },
    });
  },
);

router.get(
  "/admin/package-requests",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const status = (req.query.status as string | undefined)?.toUpperCase();
    const where =
      status && ["PENDIENTE", "APROBADA", "RECHAZADA"].includes(status)
        ? eq(packageRequestsTable.status, status)
        : undefined;
    // Alias separado para el usuario que procesó la solicitud (admin/superuser).
    // Necesario porque ya hacemos JOIN con usersTable para los datos del cliente
    // y Drizzle no permite usar la misma tabla dos veces sin alias.
    const processedByUsers = alias(usersTable, "processed_by_users");
    const rows = await db
      .select({
        id: packageRequestsTable.id,
        status: packageRequestsTable.status,
        requestedAt: packageRequestsTable.requestedAt,
        processedAt: packageRequestsTable.processedAt,
        processedNotes: packageRequestsTable.processedNotes,
        userId: packageRequestsTable.userId,
        clienteName: usersTable.name,
        clienteEmail: usersTable.email,
        businessName: customersTable.businessName,
        processedById: packageRequestsTable.processedByUserId,
        processedByName: processedByUsers.name,
        processedByEmail: processedByUsers.email,
      })
      .from(packageRequestsTable)
      .innerJoin(usersTable, eq(usersTable.id, packageRequestsTable.userId))
      .innerJoin(
        customersTable,
        eq(customersTable.id, packageRequestsTable.customerId),
      )
      .leftJoin(
        processedByUsers,
        eq(processedByUsers.id, packageRequestsTable.processedByUserId),
      )
      .where(where as any)
      .orderBy(desc(packageRequestsTable.requestedAt))
      .limit(500);
    res.json(
      rows.map((r) => ({
        id: r.id,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
        processedAt: r.processedAt ? r.processedAt.toISOString() : null,
        processedNotes: r.processedNotes,
        cliente: {
          userId: r.userId,
          name: r.clienteName,
          email: r.clienteEmail,
          businessName: r.businessName,
        },
        processedBy: r.processedById
          ? {
              userId: r.processedById,
              name: r.processedByName,
              email: r.processedByEmail,
            }
          : null,
      })),
    );
  },
);

/**
 * Asignación directa de un paquete extra por parte del admin/superuser
 * "sin que el cliente lo solicite". Suma +35 envíos a la suscripción
 * vigente del cliente, le carga el costo del paquete a la billetera
 * (idéntico al flujo de aprobación) y deja registrado el movimiento
 * en `package_requests` con status='APROBADA' y `processedByUserId` =
 * el admin que lo asignó. Esto hace que el reporte de solicitudes
 * incluya también las asignaciones manuales con autoría visible.
 */
router.post(
  "/admin/clientes/:id/assign-package",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const notes = (req.body?.notes as string | undefined) ?? null;

    const [target] = await db
      .select({
        id: usersTable.id,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!target || target.role !== "CLIENTE") {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }

    const [customer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.userId, userId));
    if (!customer) {
      res.status(400).json({
        error: "El cliente no tiene perfil de cliente configurado",
      });
      return;
    }

    const pricing = await getPricing();
    const extraPrice = pricing.extraPackagePrice;

    const result = await db.transaction(async (tx) => {
      const [latest] = await tx
        .select({ id: subscriptionsTable.id })
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.userId, userId),
            inArray(subscriptionsTable.status, ["ACTIVA", "VENCIDA"]),
          ),
        )
        .orderBy(desc(subscriptionsTable.createdAt))
        .limit(1);
      if (!latest) {
        return { kind: "no_subscription" as const };
      }

      // Recargar el plan vigente con +35 envíos.
      await tx
        .update(subscriptionsTable)
        .set({
          monthlyDeliveries: sql`${subscriptionsTable.monthlyDeliveries} + ${RECHARGE_BLOCK}`,
          status: "ACTIVA",
        })
        .where(eq(subscriptionsTable.id, latest.id));

      // Cobrar el costo del paquete a la billetera.
      await tx
        .insert(walletsTable)
        .values({ userId, balance: "0" })
        .onConflictDoNothing({ target: walletsTable.userId });
      await tx
        .update(walletsTable)
        .set({
          balance: sql`${walletsTable.balance} - ${extraPrice.toFixed(2)}`,
        })
        .where(eq(walletsTable.userId, userId));
      await tx.insert(walletTxTable).values({
        userId,
        amount: extraPrice.toFixed(2),
        type: "PAGO",
        description: `Cargo por paquete extra de ${RECHARGE_BLOCK} envíos (asignado por admin)`,
      });

      // Registrar la asignación manual como solicitud ya APROBADA, con la
      // autoría del admin que la realizó. Aparece junto a las aprobaciones
      // ordinarias en el reporte de solicitudes.
      const [created] = await tx
        .insert(packageRequestsTable)
        .values({
          userId,
          customerId: customer.id,
          status: "APROBADA",
          processedAt: new Date(),
          processedByUserId: req.user!.sub,
          processedNotes:
            notes ?? "Asignación directa por admin (sin solicitud previa).",
        })
        .returning();

      return {
        kind: "ok" as const,
        extraPrice,
        requestId: created!.id,
      };
    });

    if (result.kind === "no_subscription") {
      res.status(400).json({
        error:
          "El cliente no tiene una suscripción activa o vencida para asignarle un paquete.",
      });
      return;
    }

    // Avisar al cliente que se le asignó un paquete extra.
    await notifyUsers([userId], {
      type: "PACKAGE_ASSIGNED_BY_ADMIN",
      title: "Tu administrador te asignó un paquete extra (+35 envíos)",
      body: `Se sumaron 35 envíos a tu plan. Cargo de $${result.extraPrice.toFixed(2)} aplicado a tu billetera.`,
      link: "/wallet",
    });

    res.json({
      ok: true,
      requestId: result.requestId,
      extraPrice: result.extraPrice,
    });
  },
);

router.post(
  "/admin/package-requests/:id/approve",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const notes = (req.body?.notes as string | undefined) ?? null;
    // Leemos el precio del paquete extra antes de la transacción: es un
    // valor configurable global, no específico del cliente.
    const pricing = await getPricing();
    const extraPrice = pricing.extraPackagePrice;
    // Toda la operación corre en una sola transacción; las transiciones de
    // estado son condicionales (`status='PENDIENTE'`) para que dos admins
    // que aprueben/rechacen al mismo tiempo no puedan duplicar la recarga.
    const result = await db.transaction(async (tx) => {
      const [pending] = await tx
        .select()
        .from(packageRequestsTable)
        .where(eq(packageRequestsTable.id, id));
      if (!pending) {
        return { kind: "not_found" as const };
      }
      if (pending.status !== "PENDIENTE") {
        return { kind: "already_processed" as const };
      }

      // Recargar el último plan ACTIVA/VENCIDA del cliente con +35 envíos.
      // Usamos un UPDATE atómico por id para que el incremento sea seguro
      // bajo concurrencia.
      const [latest] = await tx
        .select({ id: subscriptionsTable.id })
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.userId, pending.userId),
            inArray(subscriptionsTable.status, ["ACTIVA", "VENCIDA"]),
          ),
        )
        .orderBy(desc(subscriptionsTable.createdAt))
        .limit(1);
      if (!latest) {
        return { kind: "no_subscription" as const };
      }

      // Marcar la solicitud como APROBADA condicionando al estado actual:
      // si otra request ya la aprobó o rechazó, este UPDATE no afecta filas
      // y abortamos sin tocar la suscripción.
      const claimed = await tx
        .update(packageRequestsTable)
        .set({
          status: "APROBADA",
          processedAt: new Date(),
          processedByUserId: req.user!.sub,
          processedNotes: notes,
        })
        .where(
          and(
            eq(packageRequestsTable.id, id),
            eq(packageRequestsTable.status, "PENDIENTE"),
          ),
        )
        .returning({ id: packageRequestsTable.id });
      if (claimed.length === 0) {
        return { kind: "already_processed" as const };
      }

      await tx
        .update(subscriptionsTable)
        .set({
          monthlyDeliveries: sql`${subscriptionsTable.monthlyDeliveries} + ${RECHARGE_BLOCK}`,
          status: "ACTIVA",
        })
        .where(eq(subscriptionsTable.id, latest.id));

      // Cargar el costo del paquete extra a la billetera del cliente.
      // Aseguramos un row de wallet (UPSERT) y descontamos en SQL atómico
      // para soportar saldo negativo sin race conditions. El movimiento
      // queda registrado como `PAGO` en el ledger para que se vea en la
      // historia de transacciones del cliente.
      await tx
        .insert(walletsTable)
        .values({ userId: pending.userId, balance: "0" })
        .onConflictDoNothing({ target: walletsTable.userId });
      await tx
        .update(walletsTable)
        .set({
          balance: sql`${walletsTable.balance} - ${extraPrice.toFixed(2)}`,
        })
        .where(eq(walletsTable.userId, pending.userId));
      await tx.insert(walletTxTable).values({
        userId: pending.userId,
        amount: extraPrice.toFixed(2),
        type: "PAGO",
        description: `Cargo por paquete extra de ${RECHARGE_BLOCK} envíos`,
      });

      return { kind: "ok" as const, extraPrice };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "Solicitud no encontrada" });
      return;
    }
    if (result.kind === "already_processed") {
      res
        .status(400)
        .json({ error: "La solicitud ya fue procesada anteriormente." });
      return;
    }
    if (result.kind === "no_subscription") {
      res
        .status(400)
        .json({ error: "El cliente no tiene una suscripción para recargar." });
      return;
    }

    // Notificar al cliente que su solicitud fue aprobada.
    try {
      const [pending] = await db
        .select({ userId: packageRequestsTable.userId })
        .from(packageRequestsTable)
        .where(eq(packageRequestsTable.id, id));
      if (pending) {
        await notifyUsers([pending.userId], {
          type: "PACKAGE_REQUEST_APPROVED",
          title: "Tu solicitud de paquete extra fue aprobada",
          body: `Se sumaron 35 envíos a tu plan. Cargo de $${result.extraPrice.toFixed(2)} aplicado a tu billetera.`,
          link: "/wallet",
        });
      }
    } catch (err) {
      console.error("notify approve failed", err);
    }

    res.json({ ok: true });
  },
);

router.post(
  "/admin/package-requests/:id/reject",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const notes = (req.body?.notes as string | undefined) ?? null;
    // Transición condicional: sólo se rechaza si la solicitud todavía está
    // PENDIENTE â€” evita pisar una APROBADA concurrente.
    const claimed = await db
      .update(packageRequestsTable)
      .set({
        status: "RECHAZADA",
        processedAt: new Date(),
        processedByUserId: req.user!.sub,
        processedNotes: notes,
      })
      .where(
        and(
          eq(packageRequestsTable.id, id),
          eq(packageRequestsTable.status, "PENDIENTE"),
        ),
      )
      .returning({ id: packageRequestsTable.id });
    if (claimed.length === 0) {
      const [exists] = await db
        .select({ id: packageRequestsTable.id })
        .from(packageRequestsTable)
        .where(eq(packageRequestsTable.id, id));
      if (!exists) {
        res.status(404).json({ error: "Solicitud no encontrada" });
        return;
      }
      res
        .status(400)
        .json({ error: "La solicitud ya fue procesada anteriormente." });
      return;
    }

    // Notificar al cliente que su solicitud fue rechazada.
    try {
      const [pending] = await db
        .select({ userId: packageRequestsTable.userId })
        .from(packageRequestsTable)
        .where(eq(packageRequestsTable.id, id));
      if (pending) {
        await notifyUsers([pending.userId], {
          type: "PACKAGE_REQUEST_REJECTED",
          title: "Tu solicitud de paquete extra fue rechazada",
          body: notes
            ? `Motivo: ${notes}`
            : "Contacta a tu administrador si necesitas más información.",
          link: "/wallet",
        });
      }
    } catch (err) {
      console.error("notify reject failed", err);
    }

    res.json({ ok: true });
  },
);

export default router;
