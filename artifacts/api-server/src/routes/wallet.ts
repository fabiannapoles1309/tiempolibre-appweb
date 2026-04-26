import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, walletsTable, walletTxTable, transactionsTable } from "@workspace/db";
import { TopUpWalletBody as TopUpBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

async function getOrCreateWallet(userId: number) {
  const [w] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
  if (w) return w;
  const [created] = await db
    .insert(walletsTable)
    .values({ userId, balance: "0" })
    .returning();
  return created!;
}

router.get("/wallet", requireAuth, async (req, res): Promise<void> => {
  const wallet = await getOrCreateWallet(req.user!.sub);
  res.json({
    userId: wallet.userId,
    balance: Number(wallet.balance),
    updatedAt: wallet.updatedAt.toISOString(),
  });
});

router.post("/wallet/topup", requireAuth, async (req, res): Promise<void> => {
  // La billetera del CLIENTE es de sólo lectura: representa la cobranza
  // acumulada por sus envíos en efectivo. No puede recargarla manualmente.
  if (req.user!.role === "CLIENTE") {
    res.status(403).json({
      error:
        "Tu billetera es sólo informativa: refleja la cobranza de tus envíos en efectivo.",
      reason: "WALLET_READONLY_FOR_CLIENTE",
    });
    return;
  }
  const parsed = TopUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const wallet = await getOrCreateWallet(req.user!.sub);
  const newBalance = Number(wallet.balance) + parsed.data.amount;
  const [updated] = await db
    .update(walletsTable)
    .set({ balance: String(newBalance) })
    .where(eq(walletsTable.userId, req.user!.sub))
    .returning();
  await db.insert(walletTxTable).values({
    userId: req.user!.sub,
    amount: String(parsed.data.amount),
    type: "TOPUP",
    description: `Recarga vía ${parsed.data.method}`,
  });
  // Also record as platform income
  await db.insert(transactionsTable).values({
    orderId: null,
    amount: String(parsed.data.amount),
    type: "INGRESO",
    method: parsed.data.method,
    description: `Recarga billetera usuario #${req.user!.sub}`,
  });
  res.json({
    userId: updated!.userId,
    balance: Number(updated!.balance),
    updatedAt: updated!.updatedAt.toISOString(),
  });
});

router.get("/wallet/transactions", requireAuth, async (req, res): Promise<void> => {
  const txs = await db
    .select()
    .from(walletTxTable)
    .where(eq(walletTxTable.userId, req.user!.sub))
    .orderBy(desc(walletTxTable.createdAt))
    .limit(100);
  res.json(
    txs.map((t) => ({
      id: t.id,
      userId: t.userId,
      amount: Number(t.amount),
      type: t.type,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  );
});

export default router;
