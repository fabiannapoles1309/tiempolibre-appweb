import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, walletsTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import {
  COOKIE_NAME,
  TOKEN_TTL_SECONDS,
  hashPassword,
  signToken,
  verifyPassword,
  type Role,
} from "../lib/auth";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  maxAge: TOKEN_TTL_SECONDS * 1000,
  path: "/",
};

function publicUser(u: {
  id: number;
  email: string;
  name: string;
  role: string;
  customerCode: string | null;
  createdAt: Date;
  mustChangePassword?: boolean;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    customerCode: u.customerCode ?? null,
    createdAt: u.createdAt.toISOString(),
    mustChangePassword: u.mustChangePassword ?? false,
  };
}

async function nextCustomerCode(): Promise<string> {
  const result = await db.execute<{ code: string }>(
    sql`SELECT 'CLI-' || lpad(nextval('customer_code_seq')::text, 6, '0') AS code`,
  );
  const row = (result as unknown as { rows?: { code: string }[] }).rows?.[0]
    ?? (Array.isArray(result) ? (result as any[])[0] : undefined);
  if (!row?.code) throw new Error("No se pudo generar customer_code");
  return row.code;
}

router.post("/auth/register", requireAuth, requireRole("ADMIN", "SUPERUSER"), async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos: " + parsed.error.message });
    return;
  }
  const { email, name, password, role } = parsed.data;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(400).json({ error: "Ese email ya está registrado" });
    return;
  }
  const requestedRole = (role as Role | undefined) ?? "CLIENTE";
  if (requestedRole === "SUPERUSER" && req.user?.role !== "SUPERUSER") {
    res.status(403).json({ error: "Solo un SUPERUSER puede crear otro SUPERUSER" });
    return;
  }
  const finalRole: Role = requestedRole;
  const passwordHash = await hashPassword(password);
  const customerCode = finalRole === "CLIENTE" ? await nextCustomerCode() : null;
  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      name,
      passwordHash,
      role: finalRole,
      customerCode,
      mustChangePassword: true,
    })
    .returning();

  if (!user) {
    res.status(500).json({ error: "No se pudo crear el usuario" });
    return;
  }

  if (finalRole === "CLIENTE") {
    await db.insert(walletsTable).values({ userId: user.id, balance: "0" }).onConflictDoNothing();
  }

  res.status(201).json({ user: publicUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }
  const role = user.role as Role;
  const token = signToken({ sub: user.id, email: user.email, role });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.status(200).json({
    user: publicUser(user),
    token,
    mustChangePassword: user.mustChangePassword ?? false,
  });
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Se requieren currentPassword y newPassword" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.sub));
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Contraseña actual incorrecta" });
    return;
  }
  const passwordHash = await hashPassword(newPassword);
  await db.update(usersTable).set({
    passwordHash,
    mustChangePassword: false,
    passwordChangeEnabled: false,
  }).where(eq(usersTable.id, req.user!.sub));
  res.json({ ok: true });
});

router.post("/admin/users/:id/reset-password", requireAuth, requireRole("ADMIN", "SUPERUSER"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    return;
  }
  const passwordHash = await hashPassword(newPassword);
  await db.update(usersTable).set({
    passwordHash,
    mustChangePassword: true,
    passwordChangeEnabled: true,
  }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

router.post("/admin/users/:id/enable-password-change", requireAuth, requireRole("ADMIN", "SUPERUSER"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  await db.update(usersTable).set({
    passwordChangeEnabled: true,
    mustChangePassword: true,
  }).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.status(200).json({ ok: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(200).json({ user: null });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.sub));
  if (!user) {
    res.status(200).json({ user: null });
    return;
  }
  res.status(200).json({ user: publicUser(user) });
});

export default router;