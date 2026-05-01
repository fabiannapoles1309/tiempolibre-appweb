import { Router, type IRouter } from "express";
import { and, eq, gte, lte, inArray, asc, desc, sql, or, isNull, isNotNull } from "drizzle-orm";
import {
  db,
  ordersTable,
  driversTable,
  usersTable,
  customersTable,
  transactionsTable,
  walletsTable,
  walletTxTable,
  subscriptionsTable,
  recipientsTable,
  type Order,
} from "@workspace/db";
import {
  CreateOrderBody,
  UpdateOrderBody,
  AssignOrderManualBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { serializeOrder } from "../lib/serializers";
import { validarZona, validarPunto } from "../lib/mapService";
import { notifyUsers } from "../services/inAppNotifications";

const router: IRouter = Router();

async function expandOrders(orders: Order[]) {
  if (orders.length === 0) return [];
  const customerIds = Array.from(new Set(orders.map((o) => o.customerId)));
  const driverIds = Array.from(
    new Set(orders.map((o) => o.driverId).filter((v): v is number => v != null)),
  );

  const customers = customerIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, customerIds))
    : [];
  const drivers = driverIds.length
    ? await db.select().from(driversTable).where(inArray(driversTable.id, driverIds))
    : [];

  const customerMap = new Map(customers.map((c) => [c.id, c.name]));
  const driverMap = new Map(drivers.map((d) => [d.id, d.name]));

  return orders.map((o) =>
    serializeOrder(
      o,
      customerMap.get(o.customerId) ?? "Cliente",
      o.driverId != null ? driverMap.get(o.driverId) ?? null : null,
    ),
  );
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const filters = [];
  const { status, zone, customerId, driverId, from, to } = req.query;

  // RBAC scoping:
  // - CLIENTE: only orders they created
  // - DRIVER: only orders assigned to their driver record (resolved via userId)
  // - ADMIN: all orders, with optional filters
  if (req.user!.role === "CLIENTE") {
    filters.push(eq(ordersTable.customerId, req.user!.sub));
  } else if (req.user!.role === "DRIVER") {
    const [driver] = await db
      .select()
      .from(driversTable)
      .where(eq(driversTable.userId, req.user!.sub));
    if (!driver) {
      res.json([]);
      return;
    }
    filters.push(eq(ordersTable.driverId, driver.id));
  }

  if (typeof status === "string") filters.push(eq(ordersTable.status, status));
  // Only ADMIN may filter by zone or by other customers/drivers via query params
  if (req.user!.role === "ADMIN") {
    if (typeof zone === "string") filters.push(eq(ordersTable.zone, zone));
    if (typeof customerId === "string")
      filters.push(eq(ordersTable.customerId, parseInt(customerId, 10)));
    if (typeof driverId === "string")
      filters.push(eq(ordersTable.driverId, parseInt(driverId, 10)));
  }
  if (typeof from === "string") filters.push(gte(ordersTable.createdAt, new Date(from)));
  if (typeof to === "string") filters.push(lte(ordersTable.createdAt, new Date(to)));

  const rows = await db
    .select()
    .from(ordersTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(ordersTable.createdAt));

  res.json(await expandOrders(rows));
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const [row] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }
  if (req.user!.role === "CLIENTE" && row.customerId !== req.user!.sub) {
    res.status(403).json({ error: "No autorizado" });
    return;
  }
  if (req.user!.role === "DRIVER") {
    const [driver] = await db
      .select()
      .from(driversTable)
      .where(eq(driversTable.userId, req.user!.sub));
    if (!driver || row.driverId !== driver.id) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }
  }
  const [serialized] = await expandOrders([row]);
  res.json(serialized);
});

router.post(
  "/orders",
  requireAuth,
  requireRole("CLIENTE"),
  async (req, res): Promise<void> => {
    const parsed = CreateOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // BILLETERA dejó de ser un método válido para el CLIENTE: su billetera
    // es de sólo lectura (cobranza). Bloqueamos el método server-side por
    // si el cliente del navegador es manipulado.
    if (req.user!.role === "CLIENTE" && parsed.data.payment === "BILLETERA") {
      res.status(400).json({
        error:
          "El método Billetera no está disponible. Usá Efectivo, Transferencia, Tarjeta o Cortesía.",
        reason: "BILLETERA_NOT_ALLOWED_FOR_CLIENTE",
      });
      return;
    }

    let amount = parsed.data.amount ?? 0;
    // Para CLIENTE el domicilio de recolección está fijado en su registro
    // (customers.pickupAddress) y no puede ser modificado al crear el envío.
    // Cargamos su perfil acá para usarlo más abajo (pickup forzado y zona).
    let myCustomerRow:
      | { id: number; zone: number | null; pickupAddress: string | null }
      | null = null;
    if (req.user!.role === "CLIENTE") {
      const [row] = await db
        .select({
          id: customersTable.id,
          zone: customersTable.zone,
          pickupAddress: customersTable.pickupAddress,
        })
        .from(customersTable)
        .where(eq(customersTable.userId, req.user!.sub));
      myCustomerRow = row ?? null;
    }

    // Para CLIENTE el destinatario (nombre + teléfono) es obligatorio porque
    // alimentamos el directorio de DESTINATARIOS y se usa para autollenado
    // en futuros pedidos.
    const recipientNameRaw = (req.body?.recipientName ?? "").toString().trim();
    if (req.user!.role === "CLIENTE") {
      if (!recipientNameRaw) {
        res.status(400).json({
          error: "Captura el nombre del destinatario.",
          reason: "RECIPIENT_NAME_REQUIRED",
        });
        return;
      }
      if (!parsed.data.recipientPhone || parsed.data.recipientPhone.length < 6) {
        res.status(400).json({
          error: "Captura el teléfono del destinatario.",
          reason: "RECIPIENT_PHONE_REQUIRED",
        });
        return;
      }
    }
    const allowMarketingSms = req.body?.allowMarketingSms === true;
    const allowMarketingEmail = req.body?.allowMarketingEmail === true;
    // Email del destinatario (opcional). Si viene, validamos formato básico
    // y normalizamos en minúsculas para mantener el directorio limpio.
    const recipientEmailRaw = (req.body?.recipientEmail ?? "")
      .toString()
      .trim()
      .toLowerCase();
    let recipientEmail: string | null = null;
    if (recipientEmailRaw) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmailRaw);
      if (!emailOk) {
        res.status(400).json({
          error: "El correo del destinatario no tiene un formato válido.",
          reason: "RECIPIENT_EMAIL_INVALID",
        });
        return;
      }
      if (recipientEmailRaw.length > 255) {
        res.status(400).json({
          error: "El correo del destinatario es demasiado largo.",
          reason: "RECIPIENT_EMAIL_TOO_LONG",
        });
        return;
      }
      recipientEmail = recipientEmailRaw;
    }
    const pickup =
      req.user!.role === "CLIENTE" && myCustomerRow?.pickupAddress
        ? myCustomerRow.pickupAddress
        : parsed.data.pickup;

    // Validación geográfica:
    // Si el cliente envió un punto explícito (pickeado en el mapa), validamos ese punto
    // contra los polígonos KML server-side, así no confiamos sólo en el cliente.
    // Si no, caemos al flujo de geocodificación de la dirección.
    let computedZone: string | null = null;
    let deliveryLat: string | null = null;
    let deliveryLng: string | null = null;
    // Cuando es CLIENTE y pasa la validación, guardamos qué suscripción se va
    // a debitar. La reserva atómica + el INSERT del pedido se ejecutan dentro
    // de una sola transacción más abajo para evitar "fugas" (envío descontado
    // sin pedido) si el INSERT falla.
    let reservedSubscriptionId: number | null = null;

    if (parsed.data.deliveryLat != null && parsed.data.deliveryLng != null) {
      const lat = Number(parsed.data.deliveryLat);
      const lng = Number(parsed.data.deliveryLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: "Coordenadas inválidas", reason: "INVALID_COORDS" });
        return;
      }
      const r = validarPunto(lat, lng);
      if (!r.zone) {
        res.status(400).json({
          error: "El punto seleccionado está fuera de la zona de cobertura.",
          reason: "FUERA_DE_ZONA",
        });
        return;
      }
      computedZone = r.zone;
      deliveryLat = String(lat);
      deliveryLng = String(lng);
    } else {
      const validation = await validarZona(parsed.data.delivery);
      if (!validation.ok) {
        const reason = validation.reason ?? "FUERA_DE_ZONA";
        const message =
          reason === "ZONAS_NO_CARGADAS"
            ? "El servicio de zonas no está disponible. Contactá a soporte."
            : reason === "DIRECCION_NO_GEOCODIFICADA"
            ? "No pudimos ubicar la dirección de entrega. Verificá que esté completa."
            : "Dirección fuera de zona de cobertura";
        res.status(400).json({ error: message, reason });
        return;
      }
      computedZone = validation.zone;
      deliveryLat = validation.point ? String(validation.point.lat) : null;
      deliveryLng = validation.point ? String(validation.point.lng) : null;
    }

    // El cliente debe tener una suscripción ACTIVA con envíos restantes
    // para poder crear un pedido (excepto SUPERUSER).
    if (req.user!.role === "CLIENTE") {
      // Restricción geográfica: el CLIENTE sólo puede crear envíos dentro
      // de su zona registrada. La zona del cliente se almacena en
      // customers.zone (entero) y los polígonos KML usan el nombre como
      // string ("1".."9"...). Comparamos como string.
      const assignedZone =
        myCustomerRow?.zone != null ? String(myCustomerRow.zone) : null;
      if (!assignedZone) {
        res.status(400).json({
          error:
            "Tu cuenta no tiene una zona asignada. Contacta a tu administrador.",
          reason: "NO_ASSIGNED_ZONE",
        });
        return;
      }
      if (computedZone !== assignedZone) {
        res.status(400).json({
          error: `Tu zona registrada es la Zona ${assignedZone}. El destino debe estar dentro de esa zona (cae en Zona ${computedZone}).`,
          reason: "FUERA_DE_ZONA_ASIGNADA",
          assignedZone,
          deliveryZone: computedZone,
        });
        return;
      }

      // Si el cliente tiene varias suscripciones ACTIVA (p.ej. una recarga que
      // generó un nuevo periodo), tomamos la más reciente â€” el mismo criterio
      // que usa GET /me/subscription para mostrarle el contador en pantalla.
      const [candidateSub] = await db
        .select()
        .from(subscriptionsTable)
        .where(
          and(
            eq(subscriptionsTable.userId, req.user!.sub),
            eq(subscriptionsTable.status, "ACTIVA"),
          ),
        )
        .orderBy(desc(subscriptionsTable.createdAt));
      if (!candidateSub) {
        res.status(402).json({
          error: "Necesitás una suscripción activa para solicitar pedidos.",
          reason: "NO_SUBSCRIPTION",
        });
        return;
      }
      if (candidateSub.monthlyDeliveries - candidateSub.usedDeliveries <= 0) {
        res.status(402).json({
          error:
            "Tu suscripción no tiene envíos restantes. Solicitá una recarga para continuar.",
          reason: "NO_DELIVERIES_LEFT",
        });
        return;
      }
      // Guardamos el id para que la reserva atómica + el INSERT del pedido
      // ocurran dentro de la misma transacción más abajo. Persistimos
      // `subscription_id` en el pedido para poder reembolsar exactamente esa
      // suscripción si después se cancela (no la "más reciente" en ese momento,
      // que podría ser otra si hubo recargas mientras tanto).
      reservedSubscriptionId = candidateSub.id;
    }

    // Cortesía: el envío no genera ingreso. El monto se fuerza a 0 aunque el
    // cliente envíe otro valor. Igualmente sigue contando como un envío del
    // bloque mensual cuando se entregue (lógica en PATCH /orders/:id).
    if (parsed.data.payment === "CORTESIA") {
      amount = 0;
    }

    // Wallet payment: deduct balance now
    if (parsed.data.payment === "BILLETERA") {
      const [wallet] = await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, req.user!.sub));
      const balance = wallet ? Number(wallet.balance) : 0;
      if (balance < amount) {
        res.status(400).json({ error: "Saldo insuficiente en la billetera" });
        return;
      }
      await db
        .update(walletsTable)
        .set({ balance: String(balance - amount) })
        .where(eq(walletsTable.userId, req.user!.sub));
      await db.insert(walletTxTable).values({
        userId: req.user!.sub,
        amount: String(amount),
        type: "PAGO",
        description: "Pago de pedido",
      });
    }

    // Reservamos el envío del bloque mensual y creamos el pedido en la misma
    // transacción. Si el INSERT del pedido falla, la reserva queda revertida y
    // el contador del cliente no se mueve (no hay "fugas" de envíos).
    let raceLost = false;
    const txResult = await db.transaction(async (tx): Promise<typeof ordersTable.$inferSelect | null> => {
      if (reservedSubscriptionId != null) {
        const [reserved] = await tx
          .update(subscriptionsTable)
          .set({
            usedDeliveries: sql`${subscriptionsTable.usedDeliveries} + 1`,
            // Si esta reserva agota el bloque, marcamos el plan como VENCIDA.
            status: sql`CASE WHEN ${subscriptionsTable.usedDeliveries} + 1 >= ${subscriptionsTable.monthlyDeliveries} THEN 'VENCIDA' ELSE ${subscriptionsTable.status} END`,
          })
          .where(
            and(
              eq(subscriptionsTable.id, reservedSubscriptionId),
              // Defensa contra carrera con cancelaciones del admin: si la
              // suscripción dejó de estar ACTIVA entre el SELECT y este
              // UPDATE, no debitamos. El cliente recibe 402 igual que cuando
              // se queda sin saldo.
              eq(subscriptionsTable.status, "ACTIVA"),
              sql`${subscriptionsTable.usedDeliveries} < ${subscriptionsTable.monthlyDeliveries}`,
            ),
          )
          .returning({ id: subscriptionsTable.id });
        if (!reserved) {
          // Carrera: alguien más consumió el último envío entre el SELECT
          // anterior y el UPDATE. Marcamos para responder 402 fuera de la tx.
          raceLost = true;
          return null;
        }
      }
      // Folio público del pedido: PED-NNNNNN. La secuencia es independiente
      // del id interno (serial PK) y se incrementa atómicamente.
      const folioRes = await tx.execute<{ code: string }>(
        sql`SELECT 'PED-' || lpad(nextval('order_folio_seq')::text, 6, '0') AS code`,
      );
      const folioRow =
        (folioRes as unknown as { rows?: { code: string }[] }).rows?.[0] ??
        (Array.isArray(folioRes) ? (folioRes as any[])[0] : undefined);
      const folio = folioRow?.code ?? null;
      const [created] = await tx
        .insert(ordersTable)
        .values({
          folio,
          customerId: req.user!.sub,
          pickup,
          delivery: parsed.data.delivery,
          zone: computedZone,
          payment: parsed.data.payment,
          amount: String(amount),
          deliveryLat,
          deliveryLng,
          recipientPhone: parsed.data.recipientPhone ?? null,
          recipientEmail,
          subscriptionId: reservedSubscriptionId,
          // Solo persistimos cashAmount/cashChange cuando el método es EFECTIVO.
          // Para otros métodos los forzamos a null aunque el cliente los envíe.
          cashAmount:
            parsed.data.payment === "EFECTIVO" && parsed.data.cashAmount != null
              ? String(Math.max(0, Number(parsed.data.cashAmount)))
              : null,
          cashChange:
            parsed.data.payment === "EFECTIVO" && parsed.data.cashChange != null
              ? String(Math.max(0, Number(parsed.data.cashChange)))
              : null,
          notes: parsed.data.notes ?? null,
          recipientName: recipientNameRaw || null,
          status: "PENDIENTE",
        })
        .returning();
      return created ?? null;
    });
    if (raceLost) {
      res.status(402).json({
        error:
          "Tu suscripción no tiene envíos restantes. Solicitá una recarga para continuar.",
        reason: "NO_DELIVERIES_LEFT",
      });
      return;
    }
    if (!txResult) {
      res.status(500).json({ error: "No se pudo crear el pedido" });
      return;
    }
    const order = txResult;

    // Upsert del destinatario en el directorio del cliente. Sólo aplica para
    // CLIENTE (los pedidos creados por ADMIN/SUPERUSER no tienen un cliente
    // emisor en este flujo). Idempotente por (customer_id, phone).
    if (
      req.user!.role === "CLIENTE" &&
      myCustomerRow &&
      recipientNameRaw &&
      parsed.data.recipientPhone
    ) {
      try {
        await db
          .insert(recipientsTable)
          .values({
            customerId: myCustomerRow.id,
            name: recipientNameRaw,
            phone: parsed.data.recipientPhone,
            email: recipientEmail,
            allowMarketingSms,
            allowMarketingEmail,
            orderCount: 1,
            lastUsedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [recipientsTable.customerId, recipientsTable.phone],
            set: {
              name: recipientNameRaw,
              // Si llegó un email nuevo lo guardamos; si vino vacío conservamos
              // el valor previo (no sobrescribimos con null para no perder
              // emails ya capturados en envíos anteriores).
              ...(recipientEmail ? { email: recipientEmail } : {}),
              allowMarketingSms,
              allowMarketingEmail,
              orderCount: sql`${recipientsTable.orderCount} + 1`,
              lastUsedAt: new Date(),
            },
          });
      } catch (err) {
        // No queremos abortar la creación del pedido por un fallo de upsert
        // del directorio. Lo registramos para diagnóstico.
        console.error("recipients upsert failed", err);
      }
    }

    // Record income transaction
    await db.insert(transactionsTable).values({
      orderId: order.id,
      amount: String(amount),
      type: "INGRESO",
      method: parsed.data.payment,
      description: `Pedido #${order.id}`,
    });

    const [serialized] = await expandOrders([order]);
    res.status(201).json(serialized);
  },
);

router.patch(
  "/orders/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = UpdateOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (req.user!.role === "CLIENTE") {
      res.status(403).json({ error: "No autorizado" });
      return;
    }

    // DRIVER may only update orders assigned to them, and cannot reassign driverId
    if (req.user!.role === "DRIVER") {
      const [driver] = await db
        .select()
        .from(driversTable)
        .where(eq(driversTable.userId, req.user!.sub));
      const [existing] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id));
      if (!driver || !existing || existing.driverId !== driver.id) {
        res.status(403).json({ error: "No autorizado" });
        return;
      }
      if (parsed.data.driverId !== undefined) {
        res.status(403).json({ error: "No podés reasignar el pedido" });
        return;
      }
    }

    const updates: Partial<typeof ordersTable.$inferInsert> = {};
    if (parsed.data.status != null) {
      updates.status = parsed.data.status;
      if (parsed.data.status === "ASIGNADO" && parsed.data.driverId == null) {
        // status alone â€” keep driver as is
      }
    }
    if (parsed.data.driverId !== undefined) {
      updates.driverId = parsed.data.driverId;
      if (parsed.data.driverId != null && parsed.data.status == null) {
        updates.status = "ASIGNADO";
      }
    }

    // Transacción: actualizar pedido + side-effects (cash + suscripción) atómicamente
    const updated = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id));
      if (!previous) return null;
      const [u] = await tx
        .update(ordersTable)
        .set(updates)
        .where(eq(ordersTable.id, id))
        .returning();
      if (!u) return null;

      const becameDelivered =
        previous.status !== "ENTREGADO" && u.status === "ENTREGADO";
      const becameCanceled =
        previous.status !== "CANCELADO" && u.status === "CANCELADO";

      // Reembolso del bloque mensual cuando se cancela un envío. El envío se
      // descuenta al solicitar (POST /orders), así que si después se cancela
      // hay que devolverlo. No bajamos el contador por debajo de 0 y, si el
      // plan estaba VENCIDA por agotamiento, lo reactivamos para reflejar que
      // ahora vuelve a tener envíos disponibles.
      if (becameCanceled && u.subscriptionId != null) {
        // Reembolsamos sobre la suscripción EXACTA que se debitó al solicitar
        // (persistida en `orders.subscription_id`), no la "última activa", para
        // evitar mover el contador equivocado si entremedio hubo recargas o
        // un nuevo periodo. Si la suscripción está VENCIDA por agotamiento, la
        // reactivamos porque ahora vuelve a tener envíos.
        const [chargedSub] = await tx
          .select()
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.id, u.subscriptionId));
        if (chargedSub && chargedSub.usedDeliveries > 0) {
          await tx
            .update(subscriptionsTable)
            .set({
              usedDeliveries: sql`GREATEST(${subscriptionsTable.usedDeliveries} - 1, 0)`,
              status:
                chargedSub.status === "VENCIDA" ? "ACTIVA" : chargedSub.status,
            })
            .where(eq(subscriptionsTable.id, chargedSub.id));
        }
      }

      if (becameDelivered) {
        if (u.driverId != null && u.payment === "EFECTIVO") {
          const [drv] = await tx
            .select()
            .from(driversTable)
            .where(eq(driversTable.id, u.driverId));
          if (drv) {
            const newCash = Number(drv.cashPending) + Number(u.amount);
            await tx
              .update(driversTable)
              .set({ cashPending: newCash.toFixed(2) })
              .where(eq(driversTable.id, drv.id));
          }
        }
        // Cobranza acumulada del CLIENTE: cuando el repartidor entrega un
        // envío en EFECTIVO, el dinero recibido del destinatario se acredita
        // en la billetera del cliente que generó el envío. Esto le permite
        // ver su saldo cobrado y la liquidación pendiente con la plataforma.
        if (
          u.customerId != null &&
          u.payment === "EFECTIVO"
        ) {
          const credit =
            u.cashAmount != null ? Number(u.cashAmount) : Number(u.amount);
          if (credit > 0) {
            const [existingWallet] = await tx
              .select()
              .from(walletsTable)
              .where(eq(walletsTable.userId, u.customerId));
            if (existingWallet) {
              const newBal = Number(existingWallet.balance) + credit;
              await tx
                .update(walletsTable)
                .set({ balance: newBal.toFixed(2) })
                .where(eq(walletsTable.userId, u.customerId));
            } else {
              await tx
                .insert(walletsTable)
                .values({ userId: u.customerId, balance: credit.toFixed(2) });
            }
            await tx.insert(walletTxTable).values({
              userId: u.customerId,
              amount: credit.toFixed(2),
              type: "TOPUP",
              description: `Cobranza en efectivo - Pedido #${u.id}`,
            });
          }
        }
        // Nota: el contador de envíos del bloque ya fue decrementado al
        // momento de crear la solicitud (POST /orders). Aquí no se vuelve a
        // tocar para evitar doble cuenta.
      }
      return u;
    });

    if (!updated) {
      res.status(404).json({ error: "Pedido no encontrado" });
      return;
    }

    const [serialized] = await expandOrders([updated]);
    res.json(serialized);
  },
);

router.post(
  "/orders/assign-auto",
  requireAuth,
  requireRole("ADMIN"),
  async (_req, res): Promise<void> => {
    const pending = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.status, "PENDIENTE"))
      .orderBy(asc(ordersTable.createdAt));

    const drivers = await db
      .select()
      .from(driversTable)
      .where(eq(driversTable.active, true));

    // Compute current driver loads (active orders not delivered/cancelled)
    const loadRows = await db
      .select({
        driverId: ordersTable.driverId,
        count: sql<number>`count(*)::int`,
      })
      .from(ordersTable)
      .where(inArray(ordersTable.status, ["ASIGNADO", "EN_RUTA"]))
      .groupBy(ordersTable.driverId);

    const loadMap = new Map<number, number>();
    for (const row of loadRows) {
      if (row.driverId != null) loadMap.set(row.driverId, row.count);
    }

    const details: { orderId: number; driverId: number | null; zone: string | null; status: string }[] = [];
    let assigned = 0;
    let skipped = 0;

    for (const order of pending) {
      if (!order.zone) {
        details.push({ orderId: order.id, driverId: null, zone: null, status: "sin_zona" });
        skipped++;
        continue;
      }
      const orderZone = order.zone;
      const candidates = drivers.filter((d) => d.zones.includes(orderZone));
      if (candidates.length === 0) {
        details.push({ orderId: order.id, driverId: null, zone: orderZone, status: "sin_drivers" });
        skipped++;
        continue;
      }
      candidates.sort(
        (a, b) => (loadMap.get(a.id) ?? 0) - (loadMap.get(b.id) ?? 0),
      );
      const chosen = candidates[0]!;
      await db
        .update(ordersTable)
        .set({ driverId: chosen.id, status: "ASIGNADO" })
        .where(eq(ordersTable.id, order.id));
      loadMap.set(chosen.id, (loadMap.get(chosen.id) ?? 0) + 1);
      details.push({ orderId: order.id, driverId: chosen.id, zone: orderZone, status: "asignado" });
      assigned++;
    }

    res.json({ assigned, skipped, details });
  },
);

/**
 * Liquidación al recoger: el repartidor marca que el cliente le pagó el
 * costo del envío en efectivo en el momento de la recolección. Queda
 * "propuesta" hasta que el cliente la confirme o dispute.
 *
 * Reglas:
 * - Sólo el DRIVER asignado al pedido puede marcarla.
 * - El pedido debe estar ASIGNADO o EN_RUTA (no se puede liquidar uno
 *   ya entregado o cancelado).
 * - Idempotente: si ya está propuesta, devolvemos 409 con el estado
 *   actual para que el frontend no muestre dos avisos al cliente.
 * - Genera notificación in-app al cliente dueño del envío.
 */
router.post(
  "/orders/:id/pickup-settle",
  requireAuth,
  requireRole("DRIVER"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const amountRaw = Number(req.body?.amount);
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
      res.status(400).json({
        error: "El monto liquidado debe ser un número positivo.",
      });
      return;
    }
    const amount = Math.round(amountRaw * 100) / 100;

    const [driver] = await db
      .select()
      .from(driversTable)
      .where(eq(driversTable.userId, req.user!.sub));
    if (!driver) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id));
    if (!order) {
      res.status(404).json({ error: "Pedido no encontrado" });
      return;
    }
    if (order.driverId !== driver.id) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }
    if (!["ASIGNADO", "EN_RUTA"].includes(order.status)) {
      res.status(400).json({
        error:
          "Sólo se puede liquidar al recoger en pedidos asignados o en ruta.",
      });
      return;
    }
    // El UPDATE condicional de abajo es la fuente de verdad para idempotencia
    // (por si dos requests del driver entran en paralelo o el cliente ya
    // confirmó/disputó entre el SELECT y este UPDATE). El check previo es
    // sólo para devolver un error claro al usuario en condiciones normales.
    if (order.pickupSettledAt && !order.pickupSettlementDisputedAt) {
      res.status(409).json({
        error: "Este pedido ya tiene una liquidación pendiente o confirmada.",
      });
      return;
    }

    // UPDATE atómico: sólo procede si el pedido sigue siendo del mismo
    // driver, sigue en estado liquidable, y NO hay propuesta vigente
    // (`pickup_settled_at IS NULL` o ya disputada). Si dos requests del
    // mismo driver entran a la vez, sólo una matchea: la otra recibe 409.
    const [updated] = await db
      .update(ordersTable)
      .set({
        pickupSettledAt: new Date(),
        pickupSettledAmount: amount.toFixed(2),
        pickupSettledByDriverId: driver.id,
        // Si venía de una disputa anterior, limpiamos para que el cliente
        // pueda volver a confirmar/disputar el nuevo intento.
        pickupSettlementConfirmedAt: null,
        pickupSettlementDisputedAt: null,
        pickupSettlementDisputeReason: null,
      })
      .where(
        and(
          eq(ordersTable.id, id),
          eq(ordersTable.driverId, driver.id),
          inArray(ordersTable.status, ["ASIGNADO", "EN_RUTA"]),
          // No hay propuesta vigente: o nunca se propuso, o el último intento
          // fue disputado por el cliente (reintento permitido).
          or(
            isNull(ordersTable.pickupSettledAt),
            isNotNull(ordersTable.pickupSettlementDisputedAt),
          ),
        ),
      )
      .returning();
    if (!updated) {
      res.status(409).json({
        error:
          "El pedido cambió de estado mientras procesábamos la liquidación. Recargá la página.",
      });
      return;
    }

    // Notificar al cliente dueño del envío.
    if (updated && updated.customerId) {
      await notifyUsers([updated.customerId], {
        type: "PICKUP_SETTLEMENT_PROPOSED",
        title: `Liquidación de envío #${updated.id} en recolección`,
        body: `El repartidor ${driver.name} marcó tu envío como liquidado en efectivo por $${amount.toFixed(2)}. Confirma o disputa desde "Mis envíos".`,
        link: `/orders/${updated.id}`,
      });
    }

    const [serialized] = await expandOrders([updated!]);
    res.json(serialized);
  },
);

/**
 * Confirmación del cliente: "sí, le pagué al repartidor en la recolección".
 * Marca pickup_settlement_confirmed_at y avisa al driver.
 */
router.post(
  "/orders/:id/pickup-settle/confirm",
  requireAuth,
  requireRole("CLIENTE"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    // UPDATE condicional atómico: sólo confirma si el pedido sigue
    // siendo del cliente autenticado, hay propuesta vigente, y NO está ya
    // confirmada NI disputada. Esto cierra la race entre confirm/dispute
    // concurrentes â€” sólo el primer UPDATE matchea.
    const [updated] = await db
      .update(ordersTable)
      .set({
        pickupSettlementConfirmedAt: new Date(),
      })
      .where(
        and(
          eq(ordersTable.id, id),
          eq(ordersTable.customerId, req.user!.sub),
          isNotNull(ordersTable.pickupSettledAt),
          isNull(ordersTable.pickupSettlementConfirmedAt),
          isNull(ordersTable.pickupSettlementDisputedAt),
        ),
      )
      .returning();
    if (!updated) {
      // Diferenciamos los motivos para una mejor UX.
      const [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id));
      if (!order || order.customerId !== req.user!.sub) {
        res.status(404).json({ error: "Pedido no encontrado" });
        return;
      }
      if (!order.pickupSettledAt) {
        res
          .status(400)
          .json({ error: "Este pedido no tiene liquidación pendiente." });
        return;
      }
      if (order.pickupSettlementConfirmedAt) {
        res.status(409).json({ error: "Ya confirmaste esta liquidación." });
        return;
      }
      if (order.pickupSettlementDisputedAt) {
        res.status(409).json({
          error:
            "Ya disputaste esta liquidación. El driver debe registrar una nueva.",
        });
        return;
      }
      res.status(409).json({ error: "No se pudo confirmar la liquidación." });
      return;
    }

    // Avisar al driver que el cliente confirmó.
    if (updated?.pickupSettledByDriverId) {
      const [drv] = await db
        .select()
        .from(driversTable)
        .where(eq(driversTable.id, updated.pickupSettledByDriverId));
      if (drv?.userId) {
        await notifyUsers([drv.userId], {
          type: "PICKUP_SETTLEMENT_CONFIRMED",
          title: `Liquidación confirmada â€” Pedido #${updated.id}`,
          body: `El cliente confirmó el pago en efectivo por $${Number(updated.pickupSettledAmount ?? 0).toFixed(2)}.`,
          link: `/orders/${updated.id}`,
        });
      }
    }
    const [serialized] = await expandOrders([updated!]);
    res.json(serialized);
  },
);

/**
 * Disputa del cliente: "no es cierto que pagué" o "el monto está mal".
 * Marca pickup_settlement_disputed_at + razón opcional, avisa al driver y
 * a los admins/superusers para auditar.
 */
router.post(
  "/orders/:id/pickup-settle/dispute",
  requireAuth,
  requireRole("CLIENTE"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const reason = (req.body?.reason ?? "").toString().trim().slice(0, 500) || null;
    // UPDATE condicional atómico: simétrico al confirm. Sólo procede si
    // hay propuesta vigente, no fue ya confirmada y no fue ya disputada.
    // Una disputa **nunca** revierte una confirmación previa, ni viceversa
    // (anti-fraude: el primer veredicto del cliente queda firme).
    const [updated] = await db
      .update(ordersTable)
      .set({
        pickupSettlementDisputedAt: new Date(),
        pickupSettlementDisputeReason: reason,
      })
      .where(
        and(
          eq(ordersTable.id, id),
          eq(ordersTable.customerId, req.user!.sub),
          isNotNull(ordersTable.pickupSettledAt),
          isNull(ordersTable.pickupSettlementConfirmedAt),
          isNull(ordersTable.pickupSettlementDisputedAt),
        ),
      )
      .returning();
    if (!updated) {
      const [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id));
      if (!order || order.customerId !== req.user!.sub) {
        res.status(404).json({ error: "Pedido no encontrado" });
        return;
      }
      if (!order.pickupSettledAt) {
        res
          .status(400)
          .json({ error: "Este pedido no tiene liquidación pendiente." });
        return;
      }
      if (order.pickupSettlementConfirmedAt) {
        res.status(409).json({
          error: "Ya confirmaste esta liquidación, no se puede disputar.",
        });
        return;
      }
      if (order.pickupSettlementDisputedAt) {
        res.status(409).json({ error: "Ya disputaste esta liquidación." });
        return;
      }
      res.status(409).json({ error: "No se pudo registrar la disputa." });
      return;
    }

    // Avisar al driver y a los admins/superusers de la disputa para
    // que puedan revisar/conciliar.
    const recipients: number[] = [];
    if (updated?.pickupSettledByDriverId) {
      const [drv] = await db
        .select()
        .from(driversTable)
        .where(eq(driversTable.id, updated.pickupSettledByDriverId));
      if (drv?.userId) recipients.push(drv.userId);
    }
    if (recipients.length) {
      await notifyUsers(recipients, {
        type: "PICKUP_SETTLEMENT_DISPUTED_BY_CUSTOMER",
        title: `El cliente disputó la liquidación del Pedido #${updated!.id}`,
        body: reason ?? "Sin motivo indicado.",
        link: `/orders/${updated!.id}`,
      });
    }
    const adminUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(inArray(usersTable.role, ["ADMIN", "SUPERUSER"]));
    if (adminUsers.length) {
      await notifyUsers(
        adminUsers.map((u) => u.id),
        {
          type: "PICKUP_SETTLEMENT_DISPUTED",
          title: `Disputa de liquidación â€” Pedido #${updated!.id}`,
          body: reason
            ? `El cliente disputa la liquidación. Motivo: ${reason}`
            : "El cliente disputa la liquidación marcada por el repartidor.",
          link: `/orders/${updated!.id}`,
        },
      );
    }

    const [serialized] = await expandOrders([updated!]);
    res.json(serialized);
  },
);

router.post(
  "/orders/:id/assign-manual",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = AssignOrderManualBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [driver] = await db
      .select()
      .from(driversTable)
      .where(eq(driversTable.id, parsed.data.driverId));
    if (!driver) {
      res.status(404).json({ error: "Driver no encontrado" });
      return;
    }
    const [updated] = await db
      .update(ordersTable)
      .set({ driverId: driver.id, status: "ASIGNADO" })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Pedido no encontrado" });
      return;
    }
    const [serialized] = await expandOrders([updated]);
    res.json(serialized);
  },
);

export default router;
