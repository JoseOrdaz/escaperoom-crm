"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, BadgeEuro, CircleDollarSign, Download, HandCoins, Loader2, Receipt, Search, UsersRound, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerSheet, type SheetCustomer } from "@/components/customers/customer-sheet";
import { useSession } from "@/components/session-provider";
import { PaymentDialog, type PaymentRow } from "./_components/payment-dialog";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type Payment, type PaymentMethod, type PaymentStatus } from "@/lib/payments";
import { cn } from "@/lib/utils";

type Row = PaymentRow & {
  roomId: string; escape: string; end: string; played: boolean; players: number; status: string; coupon: string | null; due: number;
  customer: { _id: string; name: string; email: string; phone: string } | null;
};
type Stats = {
  count: number; players: number; billed: number; collected: number; pending: number; overdue: number; avgTicket: number;
  paidCount: number; coupons: number;
  byMethod: { method: PaymentMethod | "sin-metodo"; amount: number; count: number }[];
  byRoom: { name: string; billed: number; collected: number; count: number }[];
  topCustomers: { _id: string; name: string; email: string; count: number; spent: number }[];
  days: { day: string; billed: number; collected: number; count: number }[];
};

const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const eur0 = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utcToday = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

const PRESETS: { v: string; label: string; range: () => [Date, Date] }[] = [
  { v: "today", label: "Hoy", range: () => [utcToday(), utcToday()] },
  { v: "week", label: "Esta semana", range: () => { const t = utcToday(); const m = addDays(t, -((t.getUTCDay() + 6) % 7)); return [m, addDays(m, 6)]; } },
  { v: "month", label: "Este mes", range: () => { const t = utcToday(); return [new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)), new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0))]; } },
  { v: "last-month", label: "Mes pasado", range: () => { const t = utcToday(); return [new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)), new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0))]; } },
  { v: "year", label: "Este año", range: () => { const t = utcToday(); return [new Date(Date.UTC(t.getUTCFullYear(), 0, 1)), new Date(Date.UTC(t.getUTCFullYear(), 11, 31))]; } },
];

const STATUS_STYLE: Record<PaymentStatus, string> = {
  pagado: "bg-emerald-500/10 text-emerald-700",
  parcial: "bg-sky-500/10 text-sky-700",
  pendiente: "bg-amber-500/10 text-amber-700",
};
const PAGE = 50;

export default function PaymentsPage() {
  const { info } = useSession();
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(() => ymd(PRESETS[2].range()[0]));
  const [to, setTo] = useState(() => ymd(PRESETS[2].range()[1]));
  const [escape, setEscape] = useState("all");
  const [roomId, setRoomId] = useState("all");
  const [payFilter, setPayFilter] = useState<"all" | "due" | "overdue" | PaymentStatus>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ rows: Row[]; stats: Stats; rooms: { _id: string; name: string; escape: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<Row | null>(null);
  const [viewing, setViewing] = useState<SheetCustomer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ from, to, ...(escape !== "all" ? { escape } : {}), ...(roomId !== "all" ? { roomId } : {}) });
      const res = await fetch(`/api/payments?${p}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error);
      setData(json);
    } catch (e) {
      toast.error("No se pudieron cargar los cobros", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [from, to, escape, roomId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => setPage(0), [from, to, escape, roomId, payFilter, q]);

  function choosePreset(v: string) {
    setPreset(v);
    const p = PRESETS.find((x) => x.v === v);
    if (p) {
      const [a, b] = p.range();
      setFrom(ymd(a));
      setTo(ymd(b));
    }
  }

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (payFilter === "due" && r.due <= 0) return false;
      if (payFilter === "overdue" && !(r.due > 0 && r.played)) return false;
      if ((payFilter === "pagado" || payFilter === "parcial" || payFilter === "pendiente") && r.payment.status !== payFilter) return false;
      if (s && !`${r.customer?.name ?? ""} ${r.customer?.email ?? ""} ${r.customer?.phone ?? ""} ${r.roomName} ${r.coupon ?? ""}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [data, payFilter, q]);
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const escapes = info?.escapes ?? [];
  const st = data?.stats;

  function exportCsv() {
    const head = ["Fecha", "Hora", "Sala", "Cliente", "Email", "Teléfono", "Jugadores", "Importe", "Cobrado", "Pendiente", "Estado cobro", "Método", "Cupón"];
    const lines = rows.map((r) => {
      const d = new Date(r.start);
      return [
        d.toISOString().slice(0, 10), d.toISOString().slice(11, 16), r.roomName, r.customer?.name ?? "", r.customer?.email ?? "", r.customer?.phone ?? "",
        r.players, r.price.toFixed(2).replace(".", ","), r.payment.paidAmount.toFixed(2).replace(".", ","), r.due.toFixed(2).replace(".", ","),
        PAYMENT_STATUS_LABEL[r.payment.status], r.payment.method ? PAYMENT_METHOD_LABEL[r.payment.method] : "", r.coupon ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";");
    });
    const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cobros_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Wallet className="size-6 text-primary" /> Cobros</h1>
          <p className="text-sm text-muted-foreground">Lo facturado, lo cobrado y lo que falta por cobrar de las reservas (sin canceladas).</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" /> Exportar CSV</Button>
      </div>

      {/* Filtros */}
      <section className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="inline-flex flex-wrap rounded-xl bg-muted p-1">
          {PRESETS.map((p) => (
            <button key={p.v} type="button" onClick={() => choosePreset(p.v)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", preset === p.v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{p.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Input type="date" value={from} max={to} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} className="h-9 w-[150px]" aria-label="Desde" />
          <span className="text-muted-foreground">–</span>
          <Input type="date" value={to} min={from} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} className="h-9 w-[150px]" aria-label="Hasta" />
        </div>
        {escapes.length > 1 && (
          <Select value={escape} onValueChange={(v) => { setEscape(v); setRoomId("all"); }}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los escapes</SelectItem>
              {escapes.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={roomId} onValueChange={setRoomId}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las salas</SelectItem>
            {(data?.rooms ?? []).filter((r) => escape === "all" || r.escape === escape).map((r) => <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </section>

      {!st ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi icon={Receipt} label="Facturado" value={eur0(st.billed)} hint={`${st.count} reservas · ${st.players} jugadores`} />
            <Kpi icon={CircleDollarSign} label="Cobrado" value={eur0(st.collected)} hint={`${st.billed ? Math.round((st.collected / st.billed) * 100) : 0} % de lo facturado`} tone="emerald" />
            <Kpi icon={HandCoins} label="Pendiente de cobro" value={eur0(st.pending)} hint={`${st.count - st.paidCount} reservas sin cobrar del todo`} tone="amber" onClick={() => setPayFilter("due")} />
            <Kpi icon={AlertTriangle} label="Jugadas sin cobrar" value={eur0(st.overdue)} hint="Partidas ya terminadas" tone="rose" onClick={() => setPayFilter("overdue")} />
            <Kpi icon={BadgeEuro} label="Ticket medio" value={eur(st.avgTicket)} hint={`${st.coupons} con cupón`} />
          </div>

          {/* Gráfica + desgloses */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <DaysChart days={st.days} />
            <div className="grid gap-4">
              <Breakdown title="Cobrado por método" empty="Aún no hay cobros con método" items={st.byMethod.map((m) => ({ label: m.method === "sin-metodo" ? "Sin indicar" : PAYMENT_METHOD_LABEL[m.method], value: m.amount, sub: `${m.count}` }))} />
              <Breakdown title="Por sala" empty="Sin reservas" items={st.byRoom.map((r) => ({ label: r.name, value: r.billed, sub: `${r.count}`, secondary: r.collected }))} />
            </div>
          </div>

          {st.topCustomers.length > 0 && (
            <section className="rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><UsersRound className="size-4 text-primary" /> Mejores clientes del periodo</h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {st.topCustomers.map((c, i) => (
                  <button key={c._id} type="button" onClick={() => setViewing({ _id: c._id, name: c.name, email: c.email })} className="rounded-xl border p-3 text-left transition-colors hover:border-primary/50">
                    <p className="text-xs text-muted-foreground">#{i + 1}</p>
                    <p className="truncate font-medium">{c.name || c.email}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">{eur0(c.spent)} · {c.count} {c.count === 1 ? "reserva" : "reservas"}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Tabla */}
          <section className="rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b p-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, email, teléfono, sala o cupón" className="pl-9" />
              </div>
              <div className="inline-flex flex-wrap rounded-xl bg-muted p-1 text-sm">
                {([["all", "Todas"], ["due", "Por cobrar"], ["overdue", "Jugadas sin cobrar"], ["pagado", "Cobradas"]] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setPayFilter(v)} className={cn("rounded-lg px-3 py-1.5 font-medium", payFilter === v ? "bg-card shadow-sm" : "text-muted-foreground")}>{l}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Sala</th><th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right">Importe</th><th className="px-4 py-3 text-right">Cobrado</th>
                    <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Método</th><th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pageRows.map((r) => {
                    const d = new Date(r.start);
                    return (
                      <tr key={r._id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium">{d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</p>
                          <p className="text-xs text-muted-foreground">{d.toISOString().slice(11, 16)} {r.played ? "· jugada" : ""}</p>
                        </td>
                        <td className="px-4 py-3">{r.roomName}<span className="block text-xs text-muted-foreground">{r.players} jugadores{r.coupon ? ` · ${r.coupon}` : ""}</span></td>
                        <td className="px-4 py-3">
                          {r.customer ? (
                            <button type="button" className="text-left hover:underline" onClick={() => setViewing({ _id: r.customer!._id, name: r.customer!.name, email: r.customer!.email, phone: r.customer!.phone })}>
                              <span className="font-medium">{r.customer.name || "Sin nombre"}</span>
                              <span className="block text-xs text-muted-foreground">{r.customer.phone || r.customer.email}</span>
                            </button>
                          ) : <span className="text-muted-foreground">Sin cliente</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">{eur(r.price)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{r.payment.paidAmount ? eur(r.payment.paidAmount) : "—"}{r.due > 0 && r.payment.paidAmount > 0 && <span className="block text-xs text-amber-700">faltan {eur(r.due)}</span>}</td>
                        <td className="px-4 py-3"><StatusPill p={r.payment} played={r.played} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{r.payment.method ? PAYMENT_METHOD_LABEL[r.payment.method] : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant={r.payment.status === "pagado" ? "ghost" : "outline"} onClick={() => setPaying(r)}>
                            {r.payment.status === "pagado" ? "Ver" : "Cobrar"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No hay reservas con estos filtros.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
              <span>{rows.length} reservas · {eur(rows.reduce((n, r) => n + r.price, 0))} · pendiente {eur(rows.reduce((n, r) => n + r.due, 0))}</span>
              {rows.length > PAGE && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
                  <span>{page + 1} / {Math.ceil(rows.length / PAGE)}</span>
                  <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)}>Siguiente</Button>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <PaymentDialog row={paying} onOpenChange={(o) => !o && setPaying(null)} onSaved={() => { setPaying(null); load(); }} />
      <CustomerSheet customer={viewing} open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} onEdit={() => toast.info("Edita el cliente desde el apartado Clientes")} />
    </div>
  );
}

function StatusPill({ p, played }: { p: Payment; played: boolean }) {
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[p.status], p.status === "pendiente" && played && "bg-rose-500/10 text-rose-700")}>
        {PAYMENT_STATUS_LABEL[p.status]}
      </span>
      {p.source === "plataforma-anterior" && <span className="text-[10px] text-muted-foreground">plataforma anterior</span>}
    </span>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone, onClick }: { icon: typeof Wallet; label: string; value: string; hint: string; tone?: "emerald" | "amber" | "rose"; onClick?: () => void }) {
  const toneCls = tone === "emerald" ? "bg-emerald-500/10 text-emerald-700" : tone === "amber" ? "bg-amber-500/10 text-amber-700" : tone === "rose" ? "bg-rose-500/10 text-rose-700" : "bg-primary/10 text-primary";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cn("rounded-2xl border bg-card p-4 text-left shadow-sm", onClick && "transition-colors hover:border-primary/40")}>
      <div className="flex items-center gap-2">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", toneCls)}><Icon className="size-4" /></span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </Tag>
  );
}

function Breakdown({ title, items, empty }: { title: string; empty: string; items: { label: string; value: number; sub: string; secondary?: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.label}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate">{i.label} <span className="text-xs text-muted-foreground">({i.sub})</span></span>
                <span className="font-medium tabular-nums">{eur0(i.value)}</span>
              </div>
              <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: `${(i.value / max) * 100}%` }} />
                {i.secondary !== undefined && <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${(i.secondary / max) * 100}%` }} title={`Cobrado ${eur0(i.secondary)}`} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DaysChart({ days }: { days: Stats["days"] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Si el periodo es largo, agrupamos por mes
  const points = useMemo(() => {
    if (days.length <= 45) return days.map((d) => ({ ...d, label: new Date(d.day + "T00:00:00Z").toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }) }));
    const m = new Map<string, { billed: number; collected: number; count: number }>();
    for (const d of days) {
      const k = d.day.slice(0, 7);
      const v = m.get(k) ?? { billed: 0, collected: 0, count: 0 };
      m.set(k, { billed: v.billed + d.billed, collected: v.collected + d.collected, count: v.count + d.count });
    }
    return [...m].map(([k, v]) => ({ day: k, ...v, label: new Date(k + "-01T00:00:00Z").toLocaleDateString("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" }) }));
  }, [days]);
  const max = Math.max(1, ...points.map((p) => p.billed));
  const h = hover !== null ? points[hover] : null;
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Facturado y cobrado</h2>
          <p className="text-sm text-muted-foreground">{h ? `${h.label}: ${eur0(h.billed)} facturado · ${eur0(h.collected)} cobrado · ${h.count} reservas` : days.length <= 45 ? "Por día" : "Por mes"}</p>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/30" />Facturado</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" />Cobrado</span>
        </div>
      </div>
      <div className="flex h-52 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => (
          <div key={p.day} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div className={cn("relative w-full rounded-t bg-primary/30", hover === i && "bg-primary/45")} style={{ height: `${(p.billed / max) * 100}%`, minHeight: p.billed ? 2 : 0 }}>
              <div className="absolute inset-x-0 bottom-0 rounded-t bg-emerald-500" style={{ height: p.billed ? `${Math.min(100, (p.collected / p.billed) * 100)}%` : 0 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor(points.length / 2)]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </section>
  );
}
