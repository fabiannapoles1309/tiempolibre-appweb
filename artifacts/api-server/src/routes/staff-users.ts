import { Router, type IRouter } from "express";
import { eq, or, asc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get(
  "/admin/staff-users",
  requireAuth,
  requireRole("ADMIN", "SUPERUSER"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(or(eq(usersTable.role, "ADMIN"), eq(usersTable.role, "SUPERUSER")))
      .orderBy(asc(usersTable.role), asc(usersTable.name));
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role as "ADMIN" | "SUPERUSER",
        createdAt: r.createdAt.toISOString(),
      })),
    );
  },
);

export default router;
