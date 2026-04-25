/**
 * Notification service: genera mensajes listos para enviar por SMS / WhatsApp.
 * Mantiene el copy en español rioplatense (voseo) y el branding TiempoLibre.
 */

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
