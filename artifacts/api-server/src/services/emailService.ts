/**
 * Email service: thin wrapper around Sendgrid (when connected via Replit
 * integrations) with a console-log fallback so the rest of the app works
 * even before the integration is wired up.
 *
 * Usage:
 *   await sendEmail({ to: 'admin@x.com', subject: 'Foo', text: 'Hi' });
 *
 * It NEVER throws — returns `{ sent: boolean, reason?: string }`.
 */

type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
};

type SendEmailResult = { sent: boolean; reason?: string };

const DEFAULT_FROM =
  process.env.TIEMPOLIBRE_EMAIL_FROM?.trim() ||
  process.env.RAPIDOO_EMAIL_FROM?.trim() ||
  "no-reply@tiempolibre.app";

/**
 * Resolves a Sendgrid client using Replit's integration token (if available).
 * Returns null if no token is reachable — the caller should fall back to log.
 */
async function getSendgridClient(): Promise<any | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken =
    process.env.REPL_IDENTITY
      ? `repl ${process.env.REPL_IDENTITY}`
      : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;
  if (!hostname || !xReplitToken) return null;
  try {
    const url = `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=sendgrid`;
    const resp = await fetch(url, {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const connection = data?.items?.[0];
    const apiKey =
      connection?.settings?.api_key ??
      connection?.settings?.access_token ??
      null;
    if (!apiKey) return null;
    const sgMail = (await import("@sendgrid/mail")).default;
    sgMail.setApiKey(apiKey);
    return sgMail;
  } catch {
    return null;
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const trimmed = recipients.map((r) => r.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return { sent: false, reason: "no-recipients" };
  }
  const client = await getSendgridClient();
  if (!client) {
    // Log metadata only — never the message body, to avoid leaking PII into
    // application logs.
    console.log(
      `[email-fallback] (no Sendgrid) recipients=${trimmed.length} subject="${input.subject}" bodyChars=${input.text.length}`,
    );
    return { sent: false, reason: "no-provider" };
  }
  try {
    await client.send({
      to: trimmed,
      from: input.from ?? DEFAULT_FROM,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
    console.log(
      `[email-sent] to=${trimmed.join(",")} subject=${input.subject}`,
    );
    return { sent: true };
  } catch (err: any) {
    console.error(
      `[email-error] to=${trimmed.join(",")} subject=${input.subject} err=${
        err?.message ?? String(err)
      }`,
    );
    return { sent: false, reason: "send-failed" };
  }
}
