import { Router } from 'express';
import { db } from '@workspace/db';
import { eq, and, lte } from 'drizzle-orm';
import { ordersTable } from '@workspace/db';
import { requireAuth, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/delayed-orders', requireAuth, requireRole('ADMIN', 'SUPERUSER'), async (_req, res) => {
  try {
    const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000);
    const delayed = await db.select().from(ordersTable).where(and(eq(ordersTable.status, 'EN_RUTA'), lte(ordersTable.updatedAt, fortyMinutesAgo)));
    res.json({ count: delayed.length, orders: delayed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const deliveryTimerRouter = router;
