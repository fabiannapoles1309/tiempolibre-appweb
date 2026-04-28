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
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
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
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    // Folio público sólo presente para CLIENTE (CLI-NNNNNN). Null para admin/driver.
    customerCode: u.customerCode ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

// Genera el siguiente folio de cliente usando la secuencia dedicada en Postgres.
// Devuelve un string del tipo "CLI-000042". Atómico: dos requests concurrentes
// nunca obtienen el mismo número.
async function nextCustomerCode(): Promise<string> {
  const result = await db.execute<{ code: string }>(
    sql`SELECT 'CLI-' || lpad(nextval('customer_code_seq')::text, 6, '0') AS code`,
  );
  const row = (result as unknown as { rows?: { code: string }[] }).rows?.[0]
    ?? (Array.isArray(result) ? (result as any[])[0] : undefined);
  if (!row?.code) throw new Error("No se pudo generar customer_code");
  return row.code;
}

// El alta de usuarios deja de ser pública: solo ADMIN/SUPERUSER puede crear cuentas.
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
  // Solo un SUPERUSER puede crear otro SUPERUSER; un ADMIN no puede escalar privilegios.
  if (requestedRole === "SUPERUSER" && req.user?.role !== "SUPERUSER") {
    res.status(403).json({ error: "Solo un SUPERUSER puede crear otro SUPERUSER" });
    return;
  }
  const finalRole: Role = requestedRole;
  const passwordHash = await hashPassword(password);
  // Sólo los CLIENTE reciben folio CLI-NNNNNN. Admin/driver/superuser quedan en null.
  const customerCode = finalRole === "CLIENTE" ? await nextCustomerCode() : null;
  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      name,
      passwordHash,
      role: finalRole,
      customerCode,
    })
    .returning();

  if (!user) {
    res.status(500).json({ error: "No se pudo crear el usuario" });
    return;
  }

  if (finalRole === "CLIENTE") {
    await db
      .insert(walletsTable)
      .values({ userId: user.id, balance: "0" })
      .onConflictDoNothing();
  }

  // No iniciamos sesión como el usuario recién creado: el admin sigue siendo el actor.
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
  res.status(200).json({ user: publicUser(user), token });
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
