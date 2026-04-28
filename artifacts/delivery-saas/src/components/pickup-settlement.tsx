import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  HandCoins,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Datos extra del pedido para el flujo de liquidación al recoger. Estos
 * campos vienen del API serializado pero todavía no están en el schema
 * generado por Orval, así que el caller pasa el subset que ya conoce.
 */
export interface PickupSettlementOrder {
  id: number;
  status: string;
  amount: number;
  driverId: number | null;
  customerId: number;
  pickupSettledAt: string | null;
  pickupSettledAmount: number | null;
  pickupSettlementConfirmedAt: string | null;
  pickupSettlementDisputedAt: string | null;
  pickupSettlementDisputeReason: string | null;
}

async function jsonFetch(url: string, init?: RequestInit) {
  const r = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!r.ok) {
    let message = "Error de red";
    try {
      const data = await r.json();
      message = data?.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return r.json();
}

interface DriverProps {
  order: PickupSettlementOrder;
  onChanged?: () => void;
}

/**
 * Botón + diálogo para que el repartidor marque "entrega liquidada al
 * recoger". Pide confirmar el monto cobrado en efectivo. Sólo es visible
 * cuando el pedido está ASIGNADO o EN_RUTA y todavía no hay liquidación
 * propuesta vigente.
 */
export function DriverPickupSettleButton({ order, onChanged }: DriverProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>(
    order.pickupSettledAmount != null
      ? String(order.pickupSettledAmount)
      : String(order.amount ?? ""),
  );

  const settleMutation = useMutation({
    mutationFn: () =>
      jsonFetch(`/api/orders/${order.id}/pickup-settle`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(amount) }),
      }),
    onSuccess: () => {
      toast.success("Liquidación registrada. Esperando confirmación del cliente.");
      qc.invalidateQueries();
      onChanged?.();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPendingProposal =
    !!order.pickupSettledAt && !order.pickupSettlementDisputedAt;
  const canPropose =
    ["ASIGNADO", "EN_RUTA"].includes(order.status) && !isPendingProposal;

  if (!canPropose) {
    if (isPendingProposal && !order.pickupSettlementConfirmedAt) {
      return (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-sm"
          data-testid="driver-settlement-pending"
        >
          <Loader2 className="h-4 w-4" />
          Esperando que el cliente confirme la liquidación.
        </div>
      );
    }
    if (order.pickupSettlementConfirmedAt) {
      return (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 border border-green-300 text-green-800 text-sm"
          data-testid="driver-settlement-confirmed"
        >
          <CheckCircle2 className="h-4 w-4" />
          Liquidación confirmada por el cliente.
        </div>
      );
    }
    return null;
  }

  const showRetryHint = !!order.pickupSettlementDisputedAt;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-400 text-amber-800 hover:bg-amber-50"
        onClick={() => setOpen(true)}
        data-testid="button-driver-pickup-settle"
      >
        <HandCoins className="w-4 h-4 mr-2" />
        {showRetryHint
          ? "Reintentar liquidación al recoger"
          : "Entrega liquidada por repartidor"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liquidación en recolección</DialogTitle>
            <DialogDescription>
              Confirma que el cliente te pagó el costo del envío en efectivo
              al momento de la recolección. El cliente recibirá una
              notificación para confirmar la operación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="settle-amount">Monto cobrado (MXN)</Label>
            <Input
              id="settle-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-settle-amount"
            />
            {showRetryHint && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-md p-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>
                  El cliente disputó el intento anterior. Verifica el monto
                  antes de volver a registrar.
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#00B5E2] hover:bg-[#0096BD]"
              disabled={
                settleMutation.isPending ||
                !amount ||
                Number(amount) <= 0
              }
              onClick={() => settleMutation.mutate()}
              data-testid="button-confirm-settle"
            >
              {settleMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Registrar liquidación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface CustomerProps {
  order: PickupSettlementOrder;
  variant?: "card" | "inline";
  onChanged?: () => void;
}

/**
 * UI del cliente para aceptar o disputar una liquidación al recoger
 * propuesta por el repartidor. Soporta dos disposiciones:
 * - `card` (default): bloque visible en la página de detalle del envío.
 * - `inline`: par de botones compactos para usar en la tabla de "Mis envíos".
 */
export function CustomerPickupSettleActions({
  order,
  variant = "card",
  onChanged,
}: CustomerProps) {
  const qc = useQueryClient();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");

  const isPending =
    !!order.pickupSettledAt &&
    !order.pickupSettlementConfirmedAt &&
    !order.pickupSettlementDisputedAt;

  const confirmMutation = useMutation({
    mutationFn: () =>
      jsonFetch(`/api/orders/${order.id}/pickup-settle/confirm`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Confirmaste la liquidación. ¡Gracias!");
      qc.invalidateQueries();
      onChanged?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disputeMutation = useMutation({
    mutationFn: () =>
      jsonFetch(`/api/orders/${order.id}/pickup-settle/dispute`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || null }),
      }),
    onSuccess: () => {
      toast.success("Registramos tu disputa. Un administrador la revisará.");
      qc.invalidateQueries();
      onChanged?.();
      setDisputeOpen(false);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isPending) {
    if (variant === "inline") return null;
    if (order.pickupSettlementConfirmedAt) {
      return (
        <div
          className="flex items-center gap-2 text-sm text-green-800 bg-green-50 border border-green-300 rounded-md p-3"
          data-testid="customer-settlement-confirmed"
        >
          <CheckCircle2 className="h-4 w-4" />
          Confirmaste la liquidación de este envío
          {order.pickupSettledAmount != null && (
            <span className="font-semibold ml-1">
              por ${order.pickupSettledAmount.toFixed(2)}
            </span>
          )}
          {order.pickupSettlementConfirmedAt && (
            <span className="text-xs text-muted-foreground ml-2">
              (
              {format(
                new Date(order.pickupSettlementConfirmedAt),
                "dd/MM/yyyy HH:mm",
                { locale: es },
              )}
              )
            </span>
          )}
        </div>
      );
    }
    if (order.pickupSettlementDisputedAt) {
      return (
        <div
          className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-300 rounded-md p-3"
          data-testid="customer-settlement-disputed"
        >
          <XCircle className="h-4 w-4 mt-0.5" />
          <div>
            <p className="font-medium">Disputaste la liquidación.</p>
            {order.pickupSettlementDisputeReason && (
              <p className="text-xs mt-1">
                Motivo: {order.pickupSettlementDisputeReason}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Un administrador la está revisando.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 border-green-500 text-green-700 hover:bg-green-50"
          disabled={confirmMutation.isPending}
          onClick={() => confirmMutation.mutate()}
          data-testid={`inline-confirm-${order.id}`}
          title={`Confirmar pago de $${order.pickupSettledAmount?.toFixed(2) ?? "?"}`}
        >
          {confirmMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ThumbsUp className="h-3 w-3" />
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 border-red-500 text-red-700 hover:bg-red-50"
          onClick={() => setDisputeOpen(true)}
          data-testid={`inline-dispute-${order.id}`}
          title="Disputar liquidación"
        >
          <ThumbsDown className="h-3 w-3" />
        </Button>
        <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disputar liquidación — Envío #{order.id}</DialogTitle>
              <DialogDescription>
                Contanos por qué la información del repartidor no es correcta
                para que un administrador la revise.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Ej. No le pagué en efectivo, el monto está mal..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={500}
              data-testid="input-dispute-reason"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisputeOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={disputeMutation.isPending}
                onClick={() => disputeMutation.mutate()}
                data-testid="button-confirm-dispute"
              >
                {disputeMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Disputar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div
      className="border rounded-md p-4 bg-amber-50 border-amber-300 space-y-3"
      data-testid="customer-settlement-pending"
    >
      <div className="flex items-start gap-2">
        <HandCoins className="h-5 w-5 text-amber-700 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-amber-900">
            El repartidor marcó este envío como liquidado en recolección.
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Importe declarado:{" "}
            <span className="font-bold">
              ${order.pickupSettledAmount?.toFixed(2) ?? "?"}
            </span>
            {order.pickupSettledAt && (
              <span className="ml-2 text-xs text-amber-700">
                (
                {format(
                  new Date(order.pickupSettledAt),
                  "dd/MM/yyyy HH:mm",
                  { locale: es },
                )}
                )
              </span>
            )}
          </p>
          <p className="text-xs text-amber-700 mt-2">
            ¿Le pagaste al repartidor en efectivo el costo del envío al momento
            de la recolección? Confirma o disputa esta operación.
          </p>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          className="bg-green-600 hover:bg-green-700"
          disabled={confirmMutation.isPending}
          onClick={() => confirmMutation.mutate()}
          data-testid="button-customer-confirm-settlement"
        >
          {confirmMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ThumbsUp className="h-4 w-4 mr-2" />
          )}
          Sí, le pagué — confirmar
        </Button>
        <Button
          variant="outline"
          className="border-red-400 text-red-700 hover:bg-red-50"
          onClick={() => setDisputeOpen(true)}
          data-testid="button-customer-dispute-settlement"
        >
          <ThumbsDown className="h-4 w-4 mr-2" />
          No estoy de acuerdo
        </Button>
        <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disputar liquidación — Envío #{order.id}</DialogTitle>
              <DialogDescription>
                Contanos por qué la información del repartidor no es correcta
                para que un administrador la revise.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Ej. No le pagué en efectivo, el monto está mal..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={500}
              data-testid="input-dispute-reason"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisputeOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={disputeMutation.isPending}
                onClick={() => disputeMutation.mutate()}
                data-testid="button-confirm-dispute"
              >
                {disputeMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Disputar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
