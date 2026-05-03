import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Timer, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL ?? "";

interface DeliveryTimerProps {
  orderId: number;
  onDelivered?: () => void;
}

export default function DeliveryTimer({ orderId, onDelivered }: DeliveryTimerProps) {
  const [seconds,    setSeconds]    = useState(0);
  const [running,    setRunning]    = useState(false);
  const [alerted,    setAlerted]    = useState(false);
  const [delivered,  setDelivered]  = useState(false);

  const LIMIT_SECS  = 50 * 60; // 50 minutos
  const ALERT_SECS  = 40 * 60; // alerta al minuto 40

  // Iniciar contador cuando el driver sale a ruta
  const startRoute = async () => {
    try {
      await apiFetch(`${API}/api/orders/${orderId}/start-route`, {
        method: "POST",
        credentials: "include",
      });
      setRunning(true);
      setSeconds(0);
      toast.success("🚚 Ruta iniciada — contador en marcha");
    } catch {
      toast.error("Error al iniciar ruta");
    }
  };

  // Marcar como entregado
  const markDelivered = async () => {
    try {
      await apiFetch(`${API}/api/orders/${orderId}/deliver`, {
        method: "POST",
        credentials: "include",
      });
      setRunning(false);
      setDelivered(true);
      toast.success("✅ Pedido marcado como entregado");
      onDelivered?.();
    } catch {
      toast.error("Error al marcar entrega");
    }
  };

  // Ticker cada segundo
  useEffect(() => {
    if (!running || delivered) return;
    const interval = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;

        // Alerta al minuto 40
        if (next === ALERT_SECS && !alerted) {
          setAlerted(true);
          toast.warning(
            "⚠️ Han pasado 40 minutos — verifica el estado de la entrega",
            { duration: 10000 }
          );
        }

        // Detener al llegar a 50 min
        if (next >= LIMIT_SECS) {
          clearInterval(interval);
          setRunning(false);
        }

        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, delivered, alerted]);

  const minutes = Math.floor(seconds / 60);
  const secs    = seconds % 60;
  const pct     = Math.min((seconds / LIMIT_SECS) * 100, 100);

  const barColor =
    seconds >= ALERT_SECS  ? "bg-red-500" :
    seconds >= 25 * 60     ? "bg-amber-400" :
                             "bg-[#00B5E2]";

  if (delivered) {
    return (
      <Card className="border-green-500/40 bg-green-50 dark:bg-green-950/20">
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <span className="font-medium text-green-700 dark:text-green-400">
            Pedido entregado correctamente
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-2 ${alerted ? "border-red-400" : "border-[#00B5E2]/30"}`}>
      <CardContent className="py-4 space-y-3">
        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className={`w-5 h-5 ${alerted ? "text-red-500" : "text-[#00B5E2]"}`} />
            <span className="font-semibold">Tiempo de entrega</span>
          </div>
          {alerted && (
            <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> Retraso
            </Badge>
          )}
        </div>

        {/* Cronómetro */}
        <div className="text-center">
          <span className={`text-4xl font-mono font-bold tabular-nums
            ${alerted ? "text-red-500" : "text-[#00B5E2]"}`}>
            {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            de 50:00 máximo
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-1000 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Botones */}
        <div className="flex gap-2 pt-1">
          {!running ? (
            <Button
              onClick={startRoute}
              className="flex-1 bg-[#00B5E2] hover:bg-[#009ec8] text-white"
            >
              <Timer className="w-4 h-4 mr-2" /> Salir a ruta
            </Button>
          ) : (
            <Button
              onClick={markDelivered}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar entregado
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


