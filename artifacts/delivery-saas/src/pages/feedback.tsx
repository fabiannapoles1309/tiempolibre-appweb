import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MessageSquareWarning, Send } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  type: z.enum(["QUEJA", "SUGERENCIA"]),
  subject: z
    .string()
    .trim()
    .min(1, "El asunto es requerido")
    .max(255, "Máximo 255 caracteres"),
  message: z
    .string()
    .trim()
    .min(1, "El mensaje es requerido")
    .max(4000, "Máximo 4000 caracteres"),
});

type FormValues = z.infer<typeof schema>;

export default function FeedbackPage() {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "SUGERENCIA", subject: "", message: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/me/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error ?? "No se pudo enviar tu mensaje");
      }
      toast.success(
        data.type === "QUEJA"
          ? "Tu queja fue enviada. El equipo de TiempoLibre la revisará."
          : "Gracias por tu sugerencia. La revisaremos pronto.",
      );
      form.reset({ type: data.type, subject: "", message: "" });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo enviar tu mensaje");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquareWarning className="w-7 h-7 text-[#00B5E2]" /> Quejas y Sugerencias
        </h1>
        <p className="text-muted-foreground mt-1">
          Cuéntanos cómo mejorar TiempoLibre o reporta una experiencia que no fue
          la esperada. Tu mensaje llega directo a nuestro equipo de soporte por
          correo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo mensaje</CardTitle>
          <CardDescription>
            Selecciona el tipo y describe el caso con el detalle que puedas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
              data-testid="form-feedback"
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-feedback-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SUGERENCIA">Sugerencia</SelectItem>
                        <SelectItem value="QUEJA">Queja</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asunto</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej. Problemas con el cobro en efectivo"
                        data-testid="input-feedback-subject"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensaje</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={8}
                        placeholder="Describe la situación con el mayor detalle posible..."
                        data-testid="textarea-feedback-message"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#00B5E2] hover:bg-[#0096BD]"
                data-testid="button-submit-feedback"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar al equipo de soporte
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
