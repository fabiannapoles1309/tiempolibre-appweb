import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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

const router: IRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: TOKEN_TTL_SECONDS * 1000,
  path: "/",
};

function publicUser(u: { id: number; email: string; name: string; role: string; createdAt: Date }) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
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
  const finalRole: Role = (role as Role | undefined) ?? "CLIENTE";
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({ email: email.toLowerCase(), name, passwordHash, role: finalRole })
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

  const token = signToken({ sub: user.id, email: user.email, role: finalRole });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.status(201).json({ user: publicUser(user), token });
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
