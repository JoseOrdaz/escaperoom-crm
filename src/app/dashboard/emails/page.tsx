"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Loader2, Mail, RefreshCw, Send, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EVENT_LABEL, type EmailLog } from "@/components/reservations/customer-email-panel";
import { cn } from "@/lib/utils";

type Row = EmailLog & { roomName?: string | null; reservationStart?: string | null; reservationId?: string | null };
type Trigger = "auto" | "manual";

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
/** Las sesiones se guardan como hora de pared en UTC */
const fmtSession = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

const PAGE_SIZE = 50;

export default function EmailsPage() {
  const [tab, setTab] = useState<Trigger>("auto");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<Trigger, number | null>>({ auto: null, manual: null });
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ trigger: tab, page: String(p), pageSize: String(PAGE_SIZE) });
        if (onlyErrors) qs.set("status", "error");
        const res = await fetch(`/api/email-logs?${qs}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setRows((prev) => (p === 1 ? json.items : [...prev, ...json.items]));
        setTotal(json.total);
        setPage(p);
      } catch {
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [tab, onlyErrors]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    (["auto", "manual"] as const).forEach((t) =>
      fetch(`/api/email-logs?trigger=${t}&pageSize=1`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setCounts((c) => ({ ...c, [t]: j.total ?? 0 })))
        .catch(() => {})
    );
  }, []);

  async function openPreview(id: string) {
    const res = await fetch(`/api/email-logs?id=${id}`, { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setPreview({ subject: json.item.subject, html: json.item.html ?? "" });
  }

  const tabs: { value: Trigger; label: string; icon: typeof Zap; hint: string }[] = [
    { value: "auto", label: "Automáticos", icon: Zap, hint: "Al crear una reserva y cuando el cliente cancela desde el enlace del correo." },
    { value: "manual", label: "Manuales", icon: Send, hint: "Avisos y mensajes enviados por el equipo desde la ficha de la reserva." },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Correos</h1>
          <p className="text-sm text-muted-foreground">Registro de todos los correos enviados a los clientes.</p>
        </div>
        <Button variant="outline" onClick={() => load(1)} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Actualizar
        </Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {tabs.map(({ value, label, icon: Icon, hint }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={cn(
              "flex items-start gap-4 rounded-2xl border bg-card p-5 text-left transition-colors",
              tab === value ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"
            )}
          >
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tab === value ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold">
                {label}
                <span className="rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground">{counts[value] ?? "…"}</span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{loading && rows.length === 0 ? "Cargando…" : `${total} ${total === 1 ? "correo" : "correos"}`}</p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} className="size-4 accent-primary" />
              Solo con error
            </label>
          </div>

          {!loading && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Mail className="size-6" /></span>
              <p className="font-medium">No hay correos registrados</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                El registro empieza a partir de ahora: los correos enviados antes de esta función no aparecen aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Enviado</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Reserva</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Asunto</TableHead>
                    <TableHead>Estado</TableHead>
                    {tab === "manual" && <TableHead>Por</TableHead>}
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">{fmtDateTime(r.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            r.event === "cancelled" ? "bg-rose-500/10 text-rose-700" : r.event === "manual" ? "bg-primary/10 text-primary" : r.event === "updated" ? "bg-sky-500/10 text-sky-700" : "bg-emerald-500/10 text-emerald-700"
                          )}
                        >
                          {EVENT_LABEL[r.event] ?? r.event}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{r.roomName ?? "—"}</p>
                        {r.reservationStart && <p className="text-xs text-muted-foreground tabular-nums">{fmtSession(r.reservationStart)}</p>}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-sm">{r.to?.join(", ")}</TableCell>
                      <TableCell className="max-w-72">
                        <p className="truncate text-sm">{r.subject}</p>
                        {r.message && <p className="truncate text-xs text-muted-foreground">“{r.message}”</p>}
                      </TableCell>
                      <TableCell>
                        {r.status === "sent" ? (
                          <span className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="size-4" />Enviado</span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm text-rose-700" title={r.error}><AlertTriangle className="size-4" />Error</span>
                        )}
                      </TableCell>
                      {tab === "manual" && <TableCell className="whitespace-nowrap text-sm">{r.sentBy?.name ?? "—"}</TableCell>}
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openPreview(r._id)} aria-label="Ver correo">
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {rows.length < total && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => load(page + 1)} disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />} Cargar más
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="pr-6 text-base">{preview?.subject}</DialogTitle>
            <DialogDescription>Vista previa del correo tal como se envió.</DialogDescription>
          </DialogHeader>
          <iframe title="Vista previa del correo" srcDoc={preview?.html} sandbox="" className="min-h-[60dvh] w-full flex-1 bg-white" />
        </DialogContent>
      </Dialog>
    </>
  );
}
