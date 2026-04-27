import { useState } from "react";
import { Card } from "@/components/ui/card";

export default function OrdersPage() {
  const [statusFilter] = useState("ALL");
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Pedidos</h1>
      <Card className="p-6">
        <p>Módulo de pedidos en mantenimiento (Sincronizando con API...)</p>
      </Card>
    </div>
  );
}
