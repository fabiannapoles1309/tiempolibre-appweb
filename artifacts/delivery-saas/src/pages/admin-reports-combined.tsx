import { useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Period = "DAY" | "WEEK" | "MONTH" | "YEAR";

const PERIOD_LABEL: Record<Period, string> = {
  DAY: "Día",
  WEEK: "Semana",
  MONTH: "Mes",
  YEAR: "Año",
};

export default function AdminReportsCombinedPage() {
  const today = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [period, setPeriod] = useState<Period>("MONTH");
  const [from, setFrom] = useState<string>(oneMonthAgo);
  const [to, setTo] = useState<string>(today);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (from && to && from > to) {
      toast.error("La fecha 'desde' no puede ser posterior a 'hasta'.");
      return;
    }
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const r = await apiFetch(
        `/api/admin/reports/combined?${params.toString()}`,
        { credentials: "include" },
      );
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || "Error al generar el reporte");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-combinado-${period.toLowerCase()}-${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Reporte descargado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo descargar el reporte.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="w-7 h-7 text-[#00B5E2]" /> Reporte
          combinado por cliente
        </h1>
        <p className="text-muted-foreground mt-1">
          Descarga en Excel el resumen de envíos y cobros en efectivo de cada
          cliente, agrupado por día, semana, mes o año.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parámetros</CardTitle>
          <CardDescription>
            Selecciona el período de agrupación y, opcionalmente, un rango de
            fechas. El reporte combina los envíos contratados (costo) con el
            efectivo recibido en entregas pagadas en efectivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period">Agrupar por</Label>
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as Period)}
              >
                <SelectTrigger id="period" data-testid="select-report-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["DAY", "WEEK", "MONTH", "YEAR"] as Period[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIOD_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="from">Desde</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                data-testid="input-report-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Hasta</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                data-testid="input-report-to"
              />
            </div>
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              ¿Qué incluye el archivo?
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Una fila por cliente y período con: cantidad de envíos, costo
                total y efectivo recibido.
              </li>
              <li>
                Columna "Total combinado" que suma costo de envíos + efectivo.
              </li>
              <li>Fila final de totales generales.</li>
              <li>
                Excluye envíos cancelados; el efectivo solo cuenta entregas
                completadas.
              </li>
            </ul>
          </div>

          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-[#00B5E2] hover:bg-[#0096BD]"
            data-testid="button-download-combined"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Descargar Excel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


