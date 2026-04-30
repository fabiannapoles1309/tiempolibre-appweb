import { Router } from "express";
import { sendToAdmins, APP_URL } from "../utils/mailer";

export const packageNotifyRouter = Router();

// Agregar esta función al final del handler POST existente de package-requests
// Llama: await notifyAdminsNewPackageRequest(cliente.name, cliente.email)
export async function notifyAdminsNewPackageRequest(
  clienteName: string,
  clienteEmail: string
) {
  await sendToAdmins(
    `📦 Nueva solicitud de paquete — ${clienteName}`,
    `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;
                border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#00B5E2;margin-bottom:8px">📦 Solicitud de paquete</h2>
      <p><b>Cliente:</b> ${clienteName}</p>
      <p><b>Correo:</b> ${clienteEmail}</p>
      <p style="color:#6b7280;margin-top:16px">
        Un cliente solicitó recarga de paquete (+35 envíos).
        Entra al panel para aprobarla o rechazarla.
      </p>
      <a href="${APP_URL}/admin/package-requests"
         style="display:inline-block;margin-top:20px;padding:12px 28px;
                background:#00B5E2;color:#fff;border-radius:8px;
                text-decoration:none;font-weight:bold;font-size:15px">
        Ver solicitudes →
      </a>
    </div>`
  );
}
