import { Router } from "express";
import { db } from "@workspace/db";

export const shippingCostsRouter = Router();

// GET /api/admin/shipping-costs — obtener todos los costos
shippingCostsRouter.get("/", async (_req, res) => {
  try {
    const costs = await db.query.shippingCosts.findMany({
      orderBy: (s, { asc }) => [asc(s.name)],
    });
    res.json(costs);
  } catch (e) {
    res.status(500).json({ error: "Error al obtener costos" });
  }
});

// PATCH /api/admin/shipping-costs/:id — editar costo individual
shippingCostsRouter.patch("/:id", async (req: any, res) => {
  try {
    const { amount, insuranceAmount } = req.body as {
      amount:          number;
      insuranceAmount: number;
    };

    await db
      .update(shippingCosts)
      .set({
        amount,
        insuranceAmount,
        updatedAt: new Date(),
        updatedBy: req.user?.id,
      })
      .where(eq(shippingCosts.id, Number(req.params.id)));

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar costo" });
  }
});

// POST /api/admin/shipping-costs — crear nuevo costo
shippingCostsRouter.post("/", async (req: any, res) => {
  try {
    const { name, amount, insuranceAmount } = req.body as {
      name:            string;
      amount:          number;
      insuranceAmount: number;
    };

    const created = await db
      .insert(shippingCosts)
      .values({
        name,
        amount,
        insuranceAmount,
        createdBy: req.user?.id,
      })
      .returning();

    res.json({ ok: true, cost: created[0] });
  } catch (e) {
    res.status(500).json({ error: "Error al crear costo" });
  }
});

// DELETE /api/admin/shipping-costs/:id
shippingCostsRouter.delete("/:id", async (req, res) => {
  try {
    await db
      .delete(shippingCosts)
      .where(eq(shippingCosts.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Error al eliminar costo" });
  }
});
