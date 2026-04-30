import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const ADMIN_EMAIL      = process.env.ADMIN_EMAIL      ?? "admin@tiempolibre.com";
export const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? "fabian.napoles1309@gmail.com";
export const APP_URL          = process.env.APP_URL          ?? "https://tiempolibre.com";

export async function sendToAdmins(subject: string, html: string) {
  await transporter.sendMail({
    from: `"TiempoLibre Sistema" <${process.env.SMTP_USER}>`,
    to: `${ADMIN_EMAIL}, ${SUPERADMIN_EMAIL}`,
    subject,
    html,
  });
}
