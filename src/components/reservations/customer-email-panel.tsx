"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Send, Loader2, CheckCircle2, AlertTriangle, History, ChevronDown, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type EmailLog = {
  _id: string;
  trigger: "auto" | "manual";
  event: "created" | "updated" | "cancelled" | "manual";
  status: "sent" | "error";
  error?: string;
  subject: string;
  to: string[];
  message?: string | null;
  sentBy?: { id: string; name: string } | null;
  createdAt: string;
};

export const EVENT_LABEL: Record<EmailLog["event"], string> = {
  created: "Reserva creada",
  updated: "Aviso de cambios",
  cancelled: "Cancelación",
  manual: "Mensaje",
};

const STATUS_TEMPLATE: Record<string, string> = {
  confirmada: "la confirmación de la reserva",
  pendiente: "los datos actualizados de la reserva",
  cancelada: "el aviso de cancelación",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function CustomerEmailPanel({
  reservationId,
  customerEmail,
  status,
  notify,
  onNotifyChange,
  notifyMessage,
  onNotifyMessageChange,
}: {
  reservationId: string;
  customerEmail?: string;
  status: string;
  notify: boolean;
  onNotifyChange: (v: boolean) => void;
  notifyMessage: string;
  onNotifyMessageChange: (v: string) => void;
}) {
  const [logs, setLogs] = useState<EmailLog[] | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [includeDetails, setIncludeDetails] = useState(true);
  const [sending, setSending] = useState(false);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/email-logs?reservationId=${reservationId}&pageSize=20`, { cache: "no-store" });
      const json = await res.json();
      setLogs(res.ok ? json.items : []);
    } catch {
      setLogs([]);
    }
  }, [reservationId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  async function sendNow() {
    if (!message.trim()) return toast.error("Escribe el mensaje para el cliente");
    setSending(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim() || undefined, message, includeDetails }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo enviar");
      toast.success("Mensaje enviado al cliente");
      setSubject("");
      setMessage("");
      setComposeOpen(false);
      loadLogs();
    } catch (e) {
      toast.error("No se pudo enviar el mensaje", { description: e instanceof Error ? e.message : undefined });
      loadLogs();
    } finally {
      setSending(false);
    }
  }

  const noEmail = !customerEmail;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3 border-b pb-4 pt-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Mail className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">Comunicación con el cliente</h3>
          <p className="text-xs text-muted-foreground">
            {noEmail ? "Este cliente no tiene email." : `Los correos se envían a ${customerEmail}`}
          </p>
        </div>
      </div>

      {/* Avisar al guardar */}
      <div className={cn("rounded-xl border p-4", notify && "border-primary/40 bg-primary/5")}>
        <label className="flex cursor-pointer items-start justify-between gap-4">
          <span className="flex gap-3">
            <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block text-sm font-medium">Avisar al cliente al guardar</span>
              <span className="block text-xs text-muted-foreground">
                Se enviará {STATUS_TEMPLATE[status] ?? "la reserva"} con los datos que guardes.
              </span>
            </span>
          </span>
          <Switch checked={notify} onCheckedChange={onNotifyChange} disabled={noEmail} aria-label="Avisar al cliente al guardar" />
        </label>
        {notify && (
          <div className="mt-3 space-y-1.5">
            <label htmlFor="notify-message" className="text-xs font-medium text-muted-foreground">
              Mensaje para el cliente (opcional, aparece destacado en el correo)
            </label>
            <Textarea
              id="notify-message"
              rows={3}
              value={notifyMessage}
              onChange={(e) => onNotifyMessageChange(e.target.value)}
              placeholder="Ej.: Os hemos cambiado a las 18:00 como hablamos por teléfono. ¡Os esperamos!"
              className="bg-card"
            />
          </div>
        )}
      </div>

      {/* Mensaje inmediato */}
      <div className="rounded-xl border">
        <button
          type="button"
          onClick={() => setComposeOpen((v) => !v)}
          disabled={noEmail}
          className="flex w-full items-center justify-between gap-3 p-4 text-left disabled:opacity-50"
        >
          <span className="flex items-center gap-3">
            <Send className="size-4 text-muted-foreground" />
            <span>
              <span className="block text-sm font-medium">Enviar un mensaje ahora</span>
              <span className="block text-xs text-muted-foreground">Sin guardar cambios: escribe y envía un correo al cliente.</span>
            </span>
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", composeOpen && "rotate-180")} />
        </button>
        {composeOpen && (
          <div className="space-y-3 border-t p-4">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto (opcional)" aria-label="Asunto" />
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe el mensaje para el cliente…"
              aria-label="Mensaje"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeDetails}
                  onChange={(e) => setIncludeDetails(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Incluir los datos de la reserva
              </label>
              <Button type="button" size="sm" onClick={sendNow} disabled={sending || !message.trim()}>
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Enviar mensaje
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="rounded-xl border">
        <p className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
          <History className="size-4 text-muted-foreground" /> Correos enviados
          {logs && logs.length > 0 && (
            <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{logs.length}</span>
          )}
        </p>
        {logs === null ? (
          <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando…
          </p>
        ) : logs.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Todavía no hay correos registrados para esta reserva.</p>
        ) : (
          <ul className="max-h-56 divide-y overflow-y-auto">
            {logs.map((l) => (
              <li key={l._id} className="flex items-start gap-3 px-4 py-2.5">
                {l.status === "sent" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium">{EVENT_LABEL[l.event] ?? l.event}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 text-[10px] font-semibold uppercase",
                        l.trigger === "auto" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                      )}
                    >
                      {l.trigger === "auto" ? "Automático" : "Manual"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{l.subject}</p>
                  {l.status === "error" && <p className="text-xs text-rose-600">Error: {l.error}</p>}
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p className="tabular-nums">{fmt(l.createdAt)}</p>
                  {l.sentBy?.name && <p className="max-w-24 truncate">{l.sentBy.name}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
