"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, Plus, X, Search, CalendarDays, UsersRound, Pencil, DoorOpen, List, LayoutGrid } from "lucide-react";

import ReservationModal, {
  ReservationForEdit,
  // ReservationDraft,
  // Room,
} from "@/components/reservations/reservation-modal";

import { Clock, CheckCircle, XCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";



const ALL = "__all__";

type Resv = {
  _id: string;
  roomId: string;
  roomName: string;
  start: string;
  end: string;
  players: number;
  price: number;
  priceManual?: boolean;
  priceNote?: string;
  language: "es" | "en" | "ru";
  customer?: { id?: string; name?: string; email?: string; phone?: string };
  // description?: string;
  notes?: string;
  internalNotes?: string;
  status?: "pendiente" | "confirmada" | "cancelada";
  coupon?: { code: string; type: "percent" | "amount"; value: number };
};

type PeriodKey = "upcoming" | "today" | "tomorrow" | "week" | "last7" | "month" | "custom";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "upcoming", label: "Próximas" },
  { key: "today", label: "Hoy" },
  { key: "tomorrow", label: "Mañana" },
  { key: "week", label: "Esta semana" },
  { key: "last7", label: "Últimos 7 días" },
  { key: "month", label: "Este mes" },
  { key: "custom", label: "Personalizado" },
];
const ymdLocal = (d: Date) => d.toLocaleDateString("sv-SE");
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** Rango [from, to) en días locales; la API excluye el día "to" */
function periodRange(p: PeriodKey) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  switch (p) {
    case "today": return { from: ymdLocal(t), to: ymdLocal(addDays(t, 1)) };
    case "tomorrow": return { from: ymdLocal(addDays(t, 1)), to: ymdLocal(addDays(t, 2)) };
    case "week": { const mon = addDays(t, -((t.getDay() + 6) % 7)); return { from: ymdLocal(mon), to: ymdLocal(addDays(mon, 7)) }; }
    case "last7": return { from: ymdLocal(addDays(t, -7)), to: ymdLocal(addDays(t, 1)) };
    case "month": return { from: ymdLocal(new Date(t.getFullYear(), t.getMonth(), 1)), to: ymdLocal(new Date(t.getFullYear(), t.getMonth() + 1, 1)) };
    default: { const y = new Date(t); y.setFullYear(y.getFullYear() + 1); return { from: ymdLocal(t), to: ymdLocal(y) }; }
  }
}
function fmtRange(from?: string, to?: string) {
  if (!from) return "—";
  const f = new Date(`${from}T00:00:00`);
  const last = to ? addDays(new Date(`${to}T00:00:00`), -1) : f;
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return ymdLocal(f) === ymdLocal(last) ? f.toLocaleDateString("es-ES", { weekday: "long", ...o }) : `${f.toLocaleDateString("es-ES", o)} – ${last.toLocaleDateString("es-ES", { ...o, year: "numeric" })}`;
}
/** Horas guardadas como hora de pared en UTC */
const hm = (iso: string) => new Date(iso).toISOString().substring(11, 16);

function RoomThumb({ src, name, size = "sm" }: { src?: string; name?: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "size-11 rounded-xl" : "size-8 rounded-lg";
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${cls} shrink-0 border object-cover`} />
  ) : (
    <span className={`${cls} flex shrink-0 items-center justify-center bg-muted text-muted-foreground`} title={name}><DoorOpen className="size-4" /></span>
  );
}

const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

type Filters = {
  from: string;
  to?: string;
  roomIds?: string[];
  q?: string;
};

export default function ReservationsTable() {

  const [loading, setLoading] = useState(false);


  /* ───────── Salas ───────── */
  type Room = {
    _id: string;
    name: string;
    durationMinutes: number;
    capacityMin: number;
    capacityMax: number;
    priceTable: any; // Replace 'any' with the actual type if known
    schedule: any;   // Replace 'any' with the actual type if known
    imageUrl?: string;
  };
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          // Ensure all required properties exist, fill with defaults if missing
          setRooms(
            data.map((r: any) => ({
              _id: r._id,
              name: r.name,
              durationMinutes: r.durationMinutes ?? 60,
              capacityMin: r.capacityMin ?? 2,
              capacityMax: r.capacityMax ?? 6,
              priceTable: r.priceTable ?? {},
              schedule: r.schedule ?? {},
              imageUrl: r.imageUrl ?? "",
            }))
          );
        }
      } catch {
        toast.error("Error cargando salas");
      }
    })();
  }, []);

  /* ───────── Filtros iniciales ───────── */
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const defaultTo = nextYear.toISOString().slice(0, 10);

  /* ───────── Periodos rápidos ───────── */
  const [period, setPeriod] = useState<PeriodKey>("upcoming");
  const [view, setView] = useState<"list" | "days">("list");
  function applyPeriod(p: PeriodKey) {
    setPeriod(p);
    if (p === "custom") return;
    const r = periodRange(p);
    setFilters((f) => ({ ...f, from: r.from, to: r.to }));
    // Las vistas de días encajan mejor con periodos cortos
    if (p === "last7" || p === "week") setView("days");
  }

  const [filters, setFilters] = useState<Filters>({
    from: today,
    to: defaultTo,
    roomIds: [],
    q: "",
  });
  
  /* ───────── Datos ───────── */
  const [rows, setRows] = useState<Resv[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  async function fetchData(p = 1) {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("from", filters.from || today);
      qs.set("to", filters.to || defaultTo);
      if (filters.roomIds && filters.roomIds.length > 0)
        qs.set("roomIds", filters.roomIds.join(","));
      if (filters.q) qs.set("q", filters.q);
      qs.set("page", String(p));
      qs.set("pageSize", String(pageSize));

      const res = await fetch(`/api/reservations?${qs.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(Array.isArray(json) ? json : json.items ?? []);
      setTotal(Array.isArray(json) ? json.length : json.total ?? 0);
      setPage(p);
    } catch (e) {
      toast.error("Error cargando reservas", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(1);
  }, [filters]);

  /* ───────── Modal ───────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("edit");
  const [editing, setEditing] = useState<ReservationForEdit | null>(null);
  const [prefill, setPrefill] = useState<undefined>(
    undefined
  );

  function openEdit(r: Resv) {
    setMode("edit");
    setEditing({
      _id: r._id,
      roomId: r.roomId,
      start: r.start,
      end: r.end,
      players: r.players,
      language: r.language,
      // description: r.description,
      notes: r.notes,
      internalNotes: r.internalNotes,
      status: r.status ?? "pendiente",
      coupon: r.coupon ?? undefined,
      price: r.price,
      priceManual: r.priceManual,
      priceNote: r.priceNote,
      customer: r.customer
        ? {
          id: r.customer.id,
          name: r.customer.name,
          email: r.customer.email,
          phone: r.customer.phone,
        }
        : undefined,
    });
    setPrefill(undefined);
    setModalOpen(true);
  }

  const visibleRows = rows.filter((row) => {
    const query = (filters.q ?? "").trim().toLowerCase();
    return !query || [row.customer?.name, row.customer?.email].some((value) => value?.toLowerCase().includes(query));
  });
  // Periodos pasados: lo más reciente primero
  const pastPeriod = period === "last7";
  const sortedRows = [...visibleRows].sort((a, b) => (pastPeriod ? -1 : 1) * (new Date(a.start).getTime() - new Date(b.start).getTime()));
  const byDay = Object.entries(
    sortedRows.reduce<Record<string, Resv[]>>((acc, r) => {
      (acc[new Date(r.start).toISOString().slice(0, 10)] ??= []).push(r);
      return acc;
    }, {})
  );
  const summary = {
    count: visibleRows.filter((r) => r.status !== "cancelada").length,
    players: visibleRows.filter((r) => r.status !== "cancelada").reduce((n, r) => n + (r.players || 0), 0),
    revenue: visibleRows.filter((r) => r.status !== "cancelada").reduce((n, r) => n + (r.price ?? 0), 0),
    cancelled: visibleRows.filter((r) => r.status === "cancelada").length,
  };
  const roomImage = new Map(rooms.map((r) => [r._id, r.imageUrl]));

  const Status = ({ status }: { status: Resv["status"] }) => {
    if (!status) return <span className="text-muted-foreground">—</span>;
    const config = { pendiente: { label: "Pendiente", icon: Clock, style: "bg-amber-50 text-amber-800" }, confirmada: { label: "Confirmada", icon: CheckCircle, style: "bg-emerald-50 text-emerald-800" }, cancelada: { label: "Cancelada", icon: XCircle, style: "bg-red-50 text-red-800" } }[status];
    const Icon = config.icon;
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.style}`}><Icon className="size-3.5" />{config.label}</span>;
  };

  /* ───────── Render ───────── */
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Gestión de reservas
          </h1>
          <p className="text-sm text-muted-foreground">
            Crea, edita o cancela reservas de forma rápida y centralizada
          </p>
        </div>

        <Button
          onClick={() => {
            setMode("create");
            setEditing(null);
            setPrefill(undefined);
            setModalOpen(true);
          }}
          className="shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="mr-2 h-4 w-4" /> Añadir reserva
        </Button>
      </div>


      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5" /></span><div><CardTitle className="text-base">Reservas</CardTitle><p className="mt-1 text-sm text-muted-foreground">Consulta y gestiona las reservas del periodo seleccionado.</p></div></div>
        </CardHeader>
        <CardContent className="space-y-5 px-5 py-5 sm:px-6">

          {/* Periodos */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Periodo" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  aria-selected={period === p.key}
                  onClick={() => applyPeriod(p.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${period === p.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div role="tablist" aria-label="Vista" className="flex rounded-xl bg-muted p-1">
              {([["list", "Lista", List], ["days", "Por días", LayoutGrid]] as const).map(([v, label, Icon]) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros */}
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(145px,1fr)_minmax(145px,1fr)_minmax(180px,1.2fr)_minmax(200px,1.5fr)_auto]">
            {period === "custom" ? (
              <>
                <div className="space-y-2"><Label htmlFor="reservations-from">Desde</Label><Input id="reservations-from" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="reservations-to">Hasta</Label><Input id="reservations-to" type="date" value={filters.to ?? ""} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} /></div>
              </>
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <Label>Periodo</Label>
                <p className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                  <CalendarDays className="mr-2 size-4" />{fmtRange(filters.from, filters.to)}
                </p>
              </div>
            )}

            {/* Sala */}
            {/* Salas (select con checkboxes dentro) */}
<div className="space-y-2"><Label htmlFor="reservations-rooms">Salas</Label><Select
  // No usamos "value" porque será multiselección manual
  onValueChange={() => {}} // necesario por tipado
>
  <SelectTrigger id="reservations-rooms" className="w-full">
    <SelectValue
      placeholder={
        filters.roomIds && filters.roomIds.length > 0
          ? `${filters.roomIds.length} sala${filters.roomIds.length > 1 ? "s" : ""} seleccionada${filters.roomIds.length > 1 ? "s" : ""}`
          : "Seleccionar salas"
      }
    />
  </SelectTrigger>

  <SelectContent className="max-h-64 overflow-auto p-2">
    <div className="flex flex-col gap-1">
      {rooms.map((r) => {
        const checked = filters.roomIds?.includes(r._id);
        return (
          <label
            key={r._id}
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted cursor-pointer"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => {
                setFilters((f) => {
                  const ids = new Set(f.roomIds);
                  if (value) ids.add(r._id);
                  else ids.delete(r._id);
                  return { ...f, roomIds: Array.from(ids) };
                });
              }}
            />
            <span className="text-sm">{r.name}</span>
          </label>
        );
      })}
    </div>

    {filters.roomIds?.length > 0 && (
      <div className="border-t mt-2 pt-2 flex justify-center">
        <Button
          size="sm"
          variant="ghost"
          className="text-red-500 hover:bg-red-50"
          onClick={() => setFilters((f) => ({ ...f, roomIds: [] }))}
        >
          Quitar selección
        </Button>
      </div>
    )}
  </SelectContent>
</Select></div>

            {/* Buscador */}
            <div className="space-y-2"><Label htmlFor="reservations-search">Cliente</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="reservations-search"
              placeholder="Buscar nombre o correo"
              value={filters.q ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, q: e.target.value }))
              }
              className="pl-9"
            /></div></div>

            {/* Botón Reset sutil */}
            {(
              (filters.roomIds?.length ?? 0) > 0 ||
              filters.q ||
              filters.from !== today ||
              filters.to !== defaultTo
            ) && (
                <Button
                  variant="ghost"
                  className="w-fit text-muted-foreground"
                  onClick={() => {
                    setFilters({
                      from: today,
                      to: defaultTo,
                      roomIds: [],
                      q: "",
                    });
                    setPeriod("upcoming");
                  }}
                >
                  <X className="size-4" /> Limpiar filtros
                </Button>
              )}
          </div>



          {/* Resumen del periodo */}
          {!loading && (
            <div className="grid grid-cols-2 gap-2 border-t pt-4 sm:grid-cols-4">
              {[
                { label: "Reservas", value: String(summary.count) },
                { label: "Jugadores", value: String(summary.players) },
                { label: "Facturado", value: eur(summary.revenue) },
                { label: "Canceladas", value: String(summary.cancelled) },
              ].map((x) => (
                <div key={x.label} className="rounded-xl bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{x.label}</p>
                  <p className="text-lg font-semibold tabular-nums">{x.value}</p>
                </div>
              ))}
            </div>
          )}

          {loading ? <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground" role="status"><Loader2 className="size-5 animate-spin text-primary" /> Cargando reservas…</div> : sortedRows.length === 0 ? <div className="rounded-xl border border-dashed px-6 py-12 text-center"><CalendarDays className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 font-medium">No hay reservas para mostrar</p><p className="mt-1 text-sm text-muted-foreground">Prueba con otro periodo o cambia los filtros.</p></div> : view === "days" ? (
            /* ── Vista por días ── */
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {byDay.map(([day, list]) => {
                const d = new Date(`${day}T00:00:00Z`);
                const isToday = day === today;
                const active = list.filter((r) => r.status !== "cancelada");
                return (
                  <section key={day} className={`overflow-hidden rounded-2xl border bg-card ${isToday ? "ring-2 ring-primary/40" : ""}`}>
                    <header className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex size-10 flex-col items-center justify-center rounded-xl leading-none ${isToday ? "bg-primary text-primary-foreground" : "bg-card shadow-sm"}`}>
                          <span className="text-[10px] uppercase">{d.toLocaleDateString("es-ES", { weekday: "short", timeZone: "UTC" }).replace(".", "")}</span>
                          <span className="text-base font-semibold">{d.getUTCDate()}</span>
                        </span>
                        <div>
                          <p className="font-semibold capitalize">{isToday ? "Hoy" : d.toLocaleDateString("es-ES", { weekday: "long", timeZone: "UTC" })}</p>
                          <p className="text-xs text-muted-foreground">{d.toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" })}</p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p><strong className="text-foreground">{active.length}</strong> {active.length === 1 ? "sesión" : "sesiones"}</p>
                        <p>{eur(active.reduce((n, r) => n + (r.price ?? 0), 0))}</p>
                      </div>
                    </header>
                    <ul className="divide-y">
                      {list.map((r) => {
                        const tone = r.status === "confirmada" ? "border-l-emerald-500" : r.status === "cancelada" ? "border-l-rose-400" : "border-l-amber-500";
                        return (
                          <li key={r._id}>
                            <button type="button" onClick={() => openEdit(r)} className={`flex w-full items-center gap-3 border-l-4 px-4 py-3 text-left transition-colors hover:bg-muted/40 ${tone} ${r.status === "cancelada" ? "opacity-55" : ""}`}>
                              <RoomThumb src={roomImage.get(r.roomId)} name={r.roomName} size="lg" />
                              <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                                  {hm(r.start)}–{hm(r.end)}
                                  {r.language && r.language !== "es" && <span className="rounded bg-sky-500/10 px-1.5 text-[10px] font-bold text-sky-700">{r.language.toUpperCase()}</span>}
                                </p>
                                <p className="truncate text-sm">{r.roomName || "Sala"}</p>
                                <p className="truncate text-xs text-muted-foreground">{r.customer?.name || "Sin cliente"} · {r.players} jug. · {eur(r.price ?? 0)}</p>
                              </div>
                              <Status status={r.status} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : <>
            <div className="space-y-3 md:hidden">{sortedRows.map((r) => { const date = new Date(r.start).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }); return <div key={r._id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><RoomThumb src={roomImage.get(r.roomId)} name={r.roomName} size="lg" /><div className="min-w-0"><p className="truncate font-semibold">{r.roomName || "Sala"}</p><p className="mt-0.5 text-sm text-muted-foreground">{date} · {hm(r.start)}–{hm(r.end)}</p></div></div><Status status={r.status} /></div><div className="mt-4 border-t pt-3 text-sm"><p className="font-medium">{r.customer?.name || "Sin cliente"}</p>{r.customer?.email && <p className="mt-1 break-all text-muted-foreground">{r.customer.email}</p>}<p className="mt-2 text-muted-foreground">{r.players} jugadores · {eur(r.price ?? 0)} · {r.language?.toUpperCase()}{r.coupon ? ` · ${r.coupon.code} (${r.coupon.type === "percent" ? `-${r.coupon.value}%` : `-${eur(r.coupon.value)}`})` : ""}</p></div><Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="size-4" /> Editar reserva</Button></div>; })}</div>
            <div className="hidden overflow-hidden rounded-xl border md:block"><Table className="min-w-[1050px]"><TableHeader><TableRow className="hover:bg-transparent"><TableHead>Fecha y hora</TableHead><TableHead>Sala</TableHead><TableHead>Cliente</TableHead><TableHead>Jugadores</TableHead><TableHead>Precio</TableHead><TableHead>Cupón</TableHead><TableHead>Idioma</TableHead><TableHead>Estado</TableHead><TableHead className="sticky right-0 z-10 bg-[#f8f8fc] text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{sortedRows.map((r) => { const date = new Date(r.start).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }); return <TableRow key={r._id} className={r.status === "cancelada" ? "opacity-60" : undefined}><TableCell><p className="font-medium">{date}</p><p className="mt-1 text-xs text-muted-foreground">{hm(r.start)}–{hm(r.end)}</p></TableCell><TableCell><span className="flex items-center gap-3 font-medium"><RoomThumb src={roomImage.get(r.roomId)} name={r.roomName} />{r.roomName || "Sala"}</span></TableCell><TableCell><p className="font-medium">{r.customer?.name || "Sin cliente"}</p>{r.customer?.email && <p className="mt-1 text-xs text-muted-foreground">{r.customer.email}</p>}</TableCell><TableCell><span className="flex items-center gap-1.5"><UsersRound className="size-4 text-muted-foreground" />{r.players}</span></TableCell><TableCell className="font-medium tabular-nums">{eur(r.price ?? 0)}</TableCell><TableCell>{r.coupon ? <><p className="font-medium">{r.coupon.code}</p><p className="mt-1 text-xs text-muted-foreground">{r.coupon.type === "percent" ? `-${r.coupon.value}%` : `-${eur(r.coupon.value)}`}</p></> : <span className="text-muted-foreground">—</span>}</TableCell><TableCell>{r.language && r.language !== "es" ? <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-xs font-bold text-sky-700">{r.language.toUpperCase()}</span> : <span className="uppercase text-muted-foreground">{r.language}</span>}</TableCell><TableCell><Status status={r.status} /></TableCell><TableCell className="sticky right-0 bg-card text-right"><Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="size-4" />Editar</Button></TableCell></TableRow>; })}</TableBody></Table></div>
          </>}

        </CardContent>
      </Card>

      {/* Modal */}
      <ReservationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={mode}
        reservation={editing}
        rooms={rooms}
        onSaved={async () => {
          await fetchData(page);
        }}
      />
    </div>
  );
}
