import type { Order } from "@workspace/db";

export function serializeOrder(
  o: Order,
  customerName: string,
  driverName: string | null,
) {
  return {
    id: o.id,
    customerId: o.customerId,
    customerName,
    pickup: o.pickup,
    delivery: o.delivery,
    zone: o.zone,
    payment: o.payment,
    amount: Number(o.amount),
    status: o.status,
    driverId: o.driverId,
    driverName,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}
