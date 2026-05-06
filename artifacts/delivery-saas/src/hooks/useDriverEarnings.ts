import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export type EarningsRange = "week" | "month" | "year";

export interface EarningsDay {
  date: string;
  count: number;
  revenue: number;
}

export interface DriverEarningsData {
  days: EarningsDay[];
  total: number;
  totalDeliveries: number;
  range: EarningsRange;
}

export function useDriverEarnings(range: EarningsRange = "week") {
  const [data, setData] = useState<DriverEarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    apiFetch(`/api/reports/driver/earnings?range=${range}`)
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar ganancias");
        return res.json();
      })
      .then((json: DriverEarningsData) => setData(json))
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [range]);

  return { data, isLoading, error };
}
