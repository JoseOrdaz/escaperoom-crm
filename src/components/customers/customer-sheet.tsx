"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarCheck, CheckCircle2, Clock, Loader2, Mail, MessageSquareText, Pencil, Phone, Send,
  StickyNote, Trash2, UsersRound,
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/session-provider";
import { escapeToBrand } from "@/lib/permissions";
import { isFobiaRoom } from "@/lib/venues";
import { cn } from "@/lib/utils";

export type SheetCustomer = { _id: string; name: string; email: string; phone?: string };

type Reservation = {
  _id: string; roomName: string; start: string; end: string; players: number; price: number;
  language?: string; status?: "pendiente" | "confirmada" | "cancelada"; notes?: string;
};
type Note = { _id: string; text: string; author: { id: string; name: string }; createdAt: string };
type Log = { _id: string; subject: string; status: "sent" | "error"; error?: string; trigger: string; createdAt: string; sentBy?: { name: string } | null; message?: string | null };
type Tab = "reservations" | "notes" | "email" | "history";

const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
/** Las sesiones se guardan como hora de pared en UTC */
const fmtSession = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
};
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const STATUS: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-500/10 text-amber-700" },
  confirmada: { label: "Confirmada", className: "bg-emerald-500/10 text-emerald-700" },
  cancelada: { label: "Cancelada", className: "bg-rose-500/10 text-rose-700" },
};
const BRAND_LABEL = { fobia: "Fobia", action: "Action Gates" } as const;

export function CustomerSheet({
  customer,
  open,
  onOpenChange,
  onEdit,
}: {
  customer: SheetCustomer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: (c: SheetCustomer) => void;
}) {
  const { info } = useSession();
  const brands = useMemo(() => (info?.escapes ?? []).map(escapeToBrand), [info]);
  const [tab, setTab] = useState<Tab>("reservations");
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [mail, setMail] = useState({ brand: "fobia" as "fobia" | "action", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const id = customer?._id;

  const loadReservations = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/reservations?customerId=${id}`, { cache: "no-store" });
    setReservations(res.ok ? await res.json() : []);
  }, [id]);
  const loadNotes = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/customers/${id}/notes`, { cache: "no-store" });
    setNotes(res.ok ? (await res.json()).items : []);
  }, [id]);
  const loadLogs = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/email-logs?customerId=${id}&pageSize=50`, { cache: "no-store" });
    setLogs(res.ok ? (await res.json()).items : []);
  }, [id]);

  useEffect(() => {
    if (!open || !id) return;
    setTab("reservations");
    setReservations(null);
    setNotes(null);
    setLogs(null);
    setNoteText("");
    loadReservations();
    loadNotes();
    loadLogs();
  }, [open, id, loadReservations, loadNotes, loadLogs]);

  // Marca por defecto: la del escape donde más ha reservado (si el usuario tiene acceso)
  useEffect(() => {
    if (!open) return;
    const count = { fobia: 0, action: 0 };
    (reservations ?? []).forEach((r) => {
      count[isFobiaRoom(r.roomName) ? "fobia" : "action"]++;
    });
    const preferred = count.action > count.fobia ? "action" : "fobia";
    setMail((m) => ({ ...m, brand: brands.includes(preferred) ? preferred : brands[0] ?? "fobia" }));
  }, [open, reservations, brands]);

  const active = (reservations ?? []).filter((r) => r.status !== "cancelada");
  const spent = active.reduce((n, r) => n + (r.price || 0), 0);
  const now = Date.now();
  const upcoming = active.filter((r) => new Date(r.start).getTime() >= now).length;
  const lastVisit = active
    .filter((r) => new Date(r.start).getTime() < now)
    .sort((a, b) => +new Date(b.start) - +new Date(a.start))[0];

  async function addNote() {
    if (!id || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/customers/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setNotes((n) => [json.item, ...(n ?? [])]);
      setNoteText("");
    } catch (e) {
      toast.error("No se pudo guardar la nota", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSavingNote(false);
    }
  }
  async function deleteNote(noteId: string) {
    if (!id) return;
    const res = await fetch(`/api/customers/${id}/notes?noteId=${noteId}`, { method: "DELETE" });
    if (res.ok) setNotes((n) => (n ?? []).filter((x) => x._id !== noteId));
    else toast.error("No se pudo borrar la nota");
  }
  async function sendEmail() {
    if (!id) return;
    if (!mail.subject.trim() || !mail.message.trim()) return toast.error("Escribe el asunto y el mensaje");
    setSending(true);
    try {
      const res = await fetch(`/api/customers/${id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mail),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Error al enviar");
      toast.success(`Correo enviado a ${customer?.email}`);
      setMail((m) => ({ ...m, subject: "", message: "" }));
      loadLogs();
      setTab("history");
    } catch (e) {
      toast.error("No se pudo enviar", { description: e instanceof Error ? e.message : undefined });
      loadLogs();
    } finally {
      setSending(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof Mail; count?: number }[] = [
    { key: "reservations", label: "Reservas", icon: CalendarCheck, count: reservations?.length },
    { key: "notes", label: "Notas", icon: StickyNote, count: notes?.length },
    { key: "email", label: "Enviar correo", icon: Send },
    { key: "history", label: "Correos", icon: Mail, count: logs?.length },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {customer && (
          <>
            <SheetHeader className="space-y-4 border-b p-5 text-left">
              <div className="flex items-start gap-4 pr-6">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                  {customer.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate text-lg">{customer.name}</SheetTitle>
                  <SheetDescription asChild>
                    <div className="mt-1 flex flex-col gap-0.5 text-sm">
                      <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 truncate hover:text-primary"><Mail className="size-3.5" />{customer.email}</a>
                      {customer.phone && <a href={`tel:${customer.phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 hover:text-primary"><Phone className="size-3.5" />{customer.phone}</a>}
                    </div>
                  </SheetDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => onEdit(customer)}><Pencil className="size-4" /> Editar</Button>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Reservas", value: reservations ? String(active.length) : "…" },
                  { label: "Gastado", value: reservations ? eur(spent) : "…" },
                  { label: upcoming ? "Próximas" : "Última visita", value: reservations ? (upcoming ? String(upcoming) : lastVisit ? fmtSession(lastVisit.start).date : "—") : "…" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-muted/50 px-2 py-2.5">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</dt>
                    <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{s.value}</dd>
                  </div>
                ))}
              </dl>

              <div role="tablist" className="flex gap-1 overflow-x-auto">
                {tabs.map(({ key, label, icon: Icon, count }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      tab === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" /> {label}
                    {count ? <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{count}</span> : null}
                  </button>
                ))}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {/* Reservas */}
              {tab === "reservations" && (
                reservations === null ? <Loading /> : reservations.length === 0 ? (
                  <Empty icon={CalendarCheck} text="Este cliente aún no tiene reservas." />
                ) : (
                  <ul className="space-y-2">
                    {reservations.map((r) => {
                      const s = fmtSession(r.start);
                      const e = fmtSession(r.end);
                      const st = STATUS[r.status ?? "pendiente"];
                      const future = new Date(r.start).getTime() >= now;
                      return (
                        <li key={r._id} className={cn("rounded-xl border p-3", r.status === "cancelada" && "opacity-60")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{r.roomName}</p>
                              <p className="text-sm capitalize text-muted-foreground">{s.date}</p>
                            </div>
                            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", st.className)}>{st.label}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="size-3.5" />{s.time}–{e.time}</span>
                            <span className="flex items-center gap-1"><UsersRound className="size-3.5" />{r.players}</span>
                            <span className="tabular-nums">{eur(r.price || 0)}</span>
                            {r.language && r.language !== "es" && <span className="rounded bg-sky-500/10 px-1 font-semibold text-sky-700">{r.language.toUpperCase()}</span>}
                            {future && r.status !== "cancelada" && <span className="font-medium text-primary">Próxima</span>}
                          </div>
                          {r.notes && <p className="mt-2 rounded-lg bg-muted/50 px-2 py-1.5 text-xs">{r.notes}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )
              )}

              {/* Notas */}
              {tab === "notes" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      rows={3}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
                      placeholder="Añade una nota interna sobre este cliente (preferencias, incidencias, colaborador…)"
                      aria-label="Nueva nota"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Solo la ve el equipo. ⌘/Ctrl + Enter para guardar.</p>
                      <Button size="sm" onClick={addNote} disabled={savingNote || !noteText.trim()}>
                        {savingNote ? <Loader2 className="size-4 animate-spin" /> : <StickyNote className="size-4" />} Guardar nota
                      </Button>
                    </div>
                  </div>
                  {notes === null ? <Loading /> : notes.length === 0 ? (
                    <Empty icon={StickyNote} text="Sin notas todavía." />
                  ) : (
                    <ul className="space-y-2">
                      {notes.map((n) => {
                        const canDelete = info?.role === "admin";
                        return (
                          <li key={n._id} className="group rounded-xl border bg-amber-50/50 p-3 dark:bg-amber-500/5">
                            <p className="whitespace-pre-line text-sm">{n.text}</p>
                            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{n.author?.name || "—"} · {fmtWhen(n.createdAt)}</span>
                              {canDelete && (
                                <button type="button" onClick={() => deleteNote(n._id)} className="rounded p-1 opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100" aria-label="Borrar nota">
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {/* Enviar correo */}
              {tab === "email" && (
                <div className="space-y-4">
                  {brands.length > 1 && (
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">Se envía como</p>
                      <div className="grid grid-cols-2 gap-2">
                        {brands.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setMail({ ...mail, brand: b })}
                            className={cn("rounded-xl border p-2.5 text-left text-sm", mail.brand === b ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40")}
                          >
                            <span className="font-medium">{BRAND_LABEL[b]}</span>
                            <span className="block text-xs text-muted-foreground">{b === "fobia" ? "valencia@fobiaescape.com" : "valencia@action-gates.com"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label htmlFor="cs-subject" className="text-sm font-medium">Asunto</label>
                    <Input id="cs-subject" value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="cs-message" className="text-sm font-medium">Mensaje</label>
                    <Textarea id="cs-message" rows={8} value={mail.message} onChange={(e) => setMail({ ...mail, message: e.target.value })} placeholder={`Hola ${customer.name.split(" ")[0]}…`} />
                    <p className="text-xs text-muted-foreground">Se envía con el diseño de {BRAND_LABEL[mail.brand]} y un saludo con su nombre. Queda en el registro de correos.</p>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={sendEmail} disabled={sending || !mail.subject.trim() || !mail.message.trim()}>
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar a {customer.email}
                    </Button>
                  </div>
                </div>
              )}

              {/* Historial de correos */}
              {tab === "history" && (
                logs === null ? <Loading /> : logs.length === 0 ? (
                  <Empty icon={MessageSquareText} text="No hay correos registrados para este cliente." />
                ) : (
                  <ul className="divide-y rounded-xl border">
                    {logs.map((l) => (
                      <li key={l._id} className="flex items-start gap-3 p-3">
                        {l.status === "sent" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.subject}</p>
                          {l.message && <p className="line-clamp-2 text-xs text-muted-foreground">{l.message}</p>}
                          {l.status === "error" && <p className="text-xs text-rose-600">Error: {l.error}</p>}
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          <p>{fmtWhen(l.createdAt)}</p>
                          <p>{l.trigger === "auto" ? "Automático" : l.trigger === "newsletter" ? "Newsletter" : l.sentBy?.name ?? "Manual"}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Loading() {
  return <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>;
}
function Empty({ icon: Icon, text }: { icon: typeof Mail; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
      <Icon className="size-6 opacity-40" /> {text}
    </div>
  );
}
