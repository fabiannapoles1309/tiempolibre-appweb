/**
 * Notification service: genera mensajes listos para enviar por SMS / WhatsApp.
 * Mantiene el copy en español rioplatense (voseo) y el branding TiempoLibre.
 *
 * Email delivery is delegated to `emailService.sendEmail`, which talks to
 * Sendgrid when the Replit integration is connected, or falls back to a
 * structured console log otherwise. So this module always succeeds â€” even if
 * no email provider is wired up yet.
 */

import { sendEmail } from "./emailService";

export interface DriverWelcomeInput {
  name: string;
  email: string;
  password: string;
  appUrl: string;
}

const SLOGAN = "Confianza y seguridad en cada kilometro";

/**
 * Resuelve la URL pública de la app a partir del entorno.
 * En Replit usamos REPLIT_DOMAINS; en producción se puede setear PUBLIC_APP_URL.
 */
export function resolveAppUrl(): string {
  const explicit = process.env.PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (domain) return `https://${domain}`;
  return "https://app.tiempolibre.com.ar";
}

/**
 * Mensaje de bienvenida para nuevos repartidores. Incluye nombre, usuario,
 * contraseña recién generada, link de la app y el eslogan al final.
 */
export function buildDriverWelcomeMessage(input: DriverWelcomeInput): string {
  const { name, email, password, appUrl } = input;
  const cleanUrl = appUrl.replace(/\/+$/, "");
  const firstName = name.trim().split(/\s+/)[0] ?? "Repartidor";
  return [
    `Hola ${firstName}, te damos la bienvenida a TiempoLibre.`,
    "",
    "Ya creamos tu cuenta de repartidor. Estos son tus accesos:",
    `Usuario: ${email}`,
    `Contraseña: ${password}`,
    `Ingresá desde: ${cleanUrl}/login`,
    "",
    "Por seguridad, cambiá tu contraseña la primera vez que entres.",
    "",
    SLOGAN,
  ].join("\n");
}

export interface PackageRequestNotificationInput {
  admins: Array<{ name: string; email: string }>;
  cliente: { name: string; email: string; businessName: string | null };
  requestId: number;
  appUrl: string;
}

/**
 * Construye y "envía" la notificación a admins/superusers cuando un cliente
 * solicita un nuevo paquete de entregas. Si no hay un proveedor de email
 * configurado (no hay SMTP/SendGrid integrado), simplemente registramos el
 * mensaje en consola â€” el aviso queda persistido en la tabla
 * package_requests, así que el ADMIN siempre puede actuar desde la UI
 * `/admin/solicitudes-paquetes`.
 */
export async function notifyAdminsPackageRequest(
  input: PackageRequestNotificationInput,
): Promise<void> {
  const { admins, cliente, requestId, appUrl } = input;
  const subject = `Nueva solicitud de paquete (+35 envíos) â€” ${
    cliente.businessName ?? cliente.name
  }`;
  const cleanUrl = appUrl.replace(/\/+$/, "");
  const body = [
    `El cliente ${cliente.name} (${cliente.email}) solicitó un nuevo paquete de 35 envíos.`,
    cliente.businessName ? `Establecimiento: ${cliente.businessName}` : "",
    "",
    `Aprueba o rechaza la solicitud desde: ${cleanUrl}/admin/solicitudes-paquetes`,
    `ID interno de la solicitud: #${requestId}`,
    "",
    SLOGAN,
  ]
    .filter(Boolean)
    .join("\n");

  if (admins.length === 0) {
    console.warn(
      `[notify] package-request#${requestId}: no hay ADMIN/SUPERUSER para notificar`,
    );
    return;
  }
  const recipients = admins.map((a) => a.email).filter(Boolean);
  const result = await sendEmail({
    to: recipients,
    subject,
    text: body,
  });
  console.log(
    `[notify] package-request#${requestId} â†’ ${recipients.join(",")} sent=${
      result.sent
    }${result.reason ? ` reason=${result.reason}` : ""}`,
  );
}
