import type { Order } from "@workspace/db";

export function serializeOrder(
  o: Order,
  customerName: string,
  driverName: string | null,
) {
  return {
    id: o.id,
    // Folio público del pedido (PED-NNNNNN). Independiente del id interno.
    folio: o.folio ?? null,
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
    recipientPhone: o.recipientPhone ?? null,
    cashAmount: o.cashAmount != null ? Number(o.cashAmount) : null,
    cashChange: o.cashChange != null ? Number(o.cashChange) : null,
    deliveryLat: o.deliveryLat != null ? Number(o.deliveryLat) : null,
    deliveryLng: o.deliveryLng != null ? Number(o.deliveryLng) : null,
    // Liquidación al recoger (driver→cliente). Undefined si no aplica.
    pickupSettledAt: o.pickupSettledAt ? o.pickupSettledAt.toISOString() : null,
    pickupSettledAmount:
      o.pickupSettledAmount != null ? Number(o.pickupSettledAmount) : null,
    pickupSettledByDriverId: o.pickupSettledByDriverId ?? null,
    pickupSettlementConfirmedAt: o.pickupSettlementConfirmedAt
      ? o.pickupSettlementConfirmedAt.toISOString()
      : null,
    pickupSettlementDisputedAt: o.pickupSettlementDisputedAt
      ? o.pickupSettlementDisputedAt.toISOString()
      : null,
    pickupSettlementDisputeReason: o.pickupSettlementDisputeReason ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}
