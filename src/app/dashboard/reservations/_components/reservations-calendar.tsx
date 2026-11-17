"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
} from "lucide-react";

import ReservationModal, {
  Room,
  Customer,
  ReservationForEdit,
  ReservationDraft,
} from "@/components/reservations/reservation-modal";

/* ───────── Types de /api/reservations ───────── */
type Resv = {
  _id?: string;
  roomId: string;
  roomName?: string;
  start: string;
  end: string;
  players: number;
  price: number;
  customer: { id?: string; name: string; email: string; phone?: string };
  language: "es" | "en" | "ru";
  notes?: string;
  internalNotes?: string;
  description?: string;
  status?: "pendiente" | "confirmada" | "cancelada";
  coupon?: { code: string; type: "percent" | "amount"; value: number } | null;
  priceManual?: boolean;
  priceNote?: string;
  privacy?: { accepted: boolean; at?: string | null; url?: string; source?: string } | null;
  ranking?: { teamName?: string; score?: number | null; timeSeconds?: number | null } | null;


  
};

/* ───────── Helpers ───────── */
const dateKey = (d: Date) => d.toLocaleDateString("sv-SE");
const sortByStart = (a: Resv, b: Resv) =>
  new Date(a.start).getTime() - new Date(b.start).getTime();
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1);

const addWeeks = (d: Date, n: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n * 7);
  return copy;
};

const formatDateLabel = (d: Date) => {
  const label = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

function getMonthMatrix(cursor: Date) {
  const first = startOfMonth(cursor);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const weeks: Date[][] = [];
  let cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

// ✅ Helper para mostrar la hora literal sin aplicar zona horaria
function formatTimeLiteral(isoString: string) {
  // Evita crear Date, usamos el texto original
  if (!isoString.includes("T")) return isoString;
  const time = isoString.split("T")[1]?.slice(0, 5); // "HH:MM"
  return time || "";
}


const STATUS = {
  pendiente: {
    label: "Pendiente",
    chip: "border-amber-500 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  confirmada: {
    label: "Confirmada",
    chip: "border-emerald-500 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  cancelada: {
    label: "Cancelada",
    chip: "border-rose-400 bg-rose-500/10 text-rose-700 line-through decoration-rose-400/60 hover:bg-rose-500/20 dark:text-rose-300",
    dot: "bg-rose-500",
  },
} as const;

const LANG: Record<string, { label: string; className: string }> = {
  es: { label: "ES", className: "bg-muted text-muted-foreground" },
  en: { label: "EN", className: "bg-sky-500 text-white" },
  ru: { label: "RU", className: "bg-fuchsia-600 text-white" },
};

function LangBadge({ lang }: { lang?: string }) {
  const l = LANG[lang ?? "es"] ?? LANG.es;
  return (
    <span
      className={cn("shrink-0 rounded px-1 text-[10px] font-bold leading-4 tracking-wide", l.className)}
      title={`Idioma: ${l.label}`}
    >
      {l.label}
    </span>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {Object.values(STATUS).map((s) => (
        <span key={s.label} className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", s.dot)} aria-hidden />
          {s.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5"><LangBadge lang="en" /><LangBadge lang="ru" />Partida en inglés / ruso</span>
      <span className="ml-auto hidden sm:inline">Haz clic en un día para crear una reserva</span>
    </div>
  );
}

/* ───────── Componente ───────── */
export function ReservationsCalendar({
  initialFromISO,
  initialToISO,
  initialReservations,
}: {
  initialFromISO: string;
  initialToISO: string;
  initialReservations: Resv[];
}) {
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<Resv[]>(initialReservations);
  const [loading, setLoading] = useState(false);


  /* Salas */
  const [rooms, setRooms] = useState<Room[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        setRooms(await res.json());
      } catch (e) {
        toast.error("No se pudieron cargar salas", {
          description: String(e),
        });
      }
    })();
  }, []);

  /* Clientes */
  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/customers", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setCustomers(json.items ?? []);
      } catch {
        setCustomers([]);
      }
    })();
  }, []);

  /* Carga reservas */
  async function loadRange(from: Date, to: Date) {
    setLoading(true);
    try {
    const p = new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    const res = await fetch(`/api/reservations?${p}`, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    setEvents(await res.json());
    } finally {
    setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        if (view === "month") {
          await loadRange(startOfMonth(cursor), endOfMonth(cursor));
        } else {
          const monday = new Date(cursor);
          monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
          const nextMon = new Date(monday);
          nextMon.setDate(monday.getDate() + 7);
          await loadRange(monday, nextMon);
        }
      } catch (e) {
        toast.error("No se pudieron cargar reservas", {
          description: String(e),
        });
      }
    })();
  }, [cursor, view]);

  /* Modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ReservationForEdit | null>(null);
  const [prefill, setPrefill] = useState<ReservationDraft | undefined>();

  function openCreate(day?: Date) {
    setMode("create");
    setPrefill({
      roomId: rooms[0]?._id,
      date: dateKey(day ?? new Date()),
      players: rooms[0]?.capacityMin ?? 1,
      language: "es",
      description: "",
      notes: "",
    });
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(ev: Resv) {
  setMode("edit");
  setEditing({
    _id: ev._id!,
    roomId: ev.roomId,
    start: ev.start,
    end: ev.end,
    players: ev.players,
    language: ev.language,
    notes: ev.notes ?? "",
    internalNotes: ev.internalNotes ?? "",
    status: ev.status ?? "pendiente",
    coupon: ev.coupon ?? undefined,
    price: ev.price,
    priceManual: ev.priceManual,
    priceNote: ev.priceNote,
    privacy: ev.privacy,
    ranking: ev.ranking,
    customer: ev.customer
      ? {
          id: ev.customer.id ?? ev.customer.email,
          name: ev.customer.name,
          email: ev.customer.email,
          phone: ev.customer.phone,
        }
      : undefined,
  });
  setPrefill(undefined);
  setModalOpen(true);
}


  /* Header */
  const monday = useMemo(() => {
    const m = new Date(cursor);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m;
  }, [cursor]);

  const weekLabel = useMemo(() => {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sameMonth = monday.getMonth() === sunday.getMonth();
    const a = monday.toLocaleDateString("es-ES", sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
    const b = sunday.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    return `${a} – ${b}`;
  }, [monday]);

  function header() {
    const step = (n: number) =>
      setCursor(view === "month" ? addMonths(cursor, n) : addWeeks(cursor, n));
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
          <div className="flex items-center rounded-lg border bg-card">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => step(-1)}
              aria-label={view === "month" ? "Mes anterior" : "Semana anterior"}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-l-none border-l"
              onClick={() => step(1)}
              aria-label={view === "month" ? "Mes siguiente" : "Semana siguiente"}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="ml-1 text-lg font-semibold">
            {view === "month" ? formatDateLabel(cursor) : weekLabel}
          </h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Cargando" />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Vista" className="flex rounded-lg bg-muted p-1">
            {(
              [
                ["month", "Mes", CalendarRange],
                ["week", "Semana", CalendarDays],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <Button disabled={rooms.length === 0} onClick={() => openCreate()}>
            <Plus className="mr-1 h-4 w-4" /> Nueva reserva
          </Button>
        </div>
      </div>
    );
  }

  /* Vistas */
  const weeks = useMemo(() => getMonthMatrix(cursor), [cursor]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Resv[]>();
    for (const ev of events) {
      const k = dateKey(new Date(ev.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    }
    for (const [, arr] of map) arr.sort(sortByStart);
    return map;
  }, [events]);

  const todayKey = dateKey(new Date());

  function EventChip({ ev }: { ev: Resv }) {
    const tone = STATUS[ev.status ?? "pendiente"];
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openEdit(ev);
        }}
        title={`${formatTimeLiteral(ev.start)} · ${ev.roomName ?? "Sala"} · ${tone.label} · ${(ev.language ?? "es").toUpperCase()}`}
        className={cn(
          "flex w-full items-center gap-1.5 truncate rounded-[5px] border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-5 transition-colors",
          tone.chip
        )}
      >
        <span className="font-semibold tabular-nums">{formatTimeLiteral(ev.start)}</span>
        <span className="min-w-0 flex-1 truncate">{ev.roomName}</span>
        {ev.language && ev.language !== "es" && <LangBadge lang={ev.language} />}
      </button>
    );
  }

  function MonthView() {
    const MAX = 3;
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[720px] overflow-hidden rounded-xl border bg-border">
          <div className="grid grid-cols-7 gap-px">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <div
                key={day}
                className="bg-muted/60 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {weeks.flat().map((d) => {
              const key = dateKey(d);
              const dayEvents = eventsByDay.get(key) ?? [];
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = key === todayKey;
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Nueva reserva el ${d.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`}
                  onClick={() => rooms.length > 0 && openCreate(d)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      if (rooms.length > 0) openCreate(d);
                    }
                  }}
                  className={cn(
                    "group flex min-h-[112px] cursor-pointer flex-col gap-1 p-1.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                    inMonth ? (weekend ? "bg-[#fafafd] dark:bg-card" : "bg-card") : "bg-muted/70",
                    "hover:bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between px-0.5">
                    <span
                      className={cn(
                        "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/60"
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, MAX).map((ev) => (
                      <EventChip key={ev._id} ev={ev} />
                    ))}
                    {dayEvents.length > MAX && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCursor(d);
                          setView("week");
                        }}
                        className="px-1.5 text-left text-[11px] font-medium text-primary hover:underline"
                      >
                        +{dayEvents.length - MAX} más
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function WeekView() {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((d) => {
          const key = dateKey(d);
          const isToday = key === todayKey;
          const dayEvents = eventsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "flex flex-col rounded-xl border bg-card",
                isToday && "border-primary/50 ring-1 ring-primary/30"
              )}
            >
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    {d.toLocaleDateString("es-ES", { weekday: "short" })}
                  </span>
                  <span
                    className={cn(
                      "flex h-7 min-w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                      isToday && "bg-primary text-primary-foreground"
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={rooms.length === 0}
                  onClick={() => openCreate(d)}
                  aria-label="Nueva reserva este día"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {dayEvents.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Sin reservas</p>
                ) : (
                  dayEvents.map((ev) => {
                    const tone = STATUS[ev.status ?? "pendiente"];
                    return (
                      <button
                        type="button"
                        key={ev._id}
                        onClick={() => openEdit(ev)}
                        className={cn(
                          "rounded-[8px] border-l-[3px] p-2 text-left transition-colors",
                          tone.chip
                        )}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold tabular-nums">
                            {formatTimeLiteral(ev.start)}–{formatTimeLiteral(ev.end)}
                          </span>
                          <LangBadge lang={ev.language} />
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                          {ev.roomName || "Sala"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ev.players} jugadores · {tone.label}
                        </p>
                        {ev.customer?.name && (
                          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <UserRound className="size-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{ev.customer.name}</span>
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header()}
      <div className={cn("transition-opacity", loading && "pointer-events-none opacity-60")}>
        {view === "month" ? <MonthView /> : <WeekView />}
      </div>
      <StatusLegend />

      <ReservationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={mode}
        reservation={editing}
        prefill={prefill}
        initialDate={mode === "create" ? prefill?.date : undefined}
        rooms={rooms}
        enableCustomerSelect
        onSaved={async () => {
          if (view === "month") {
            await loadRange(startOfMonth(cursor), endOfMonth(cursor));
          } else {
            const monday = new Date(cursor);
            monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
            const nextMon = new Date(monday);
            nextMon.setDate(monday.getDate() + 7);
            await loadRange(monday, nextMon);
          }
        }}
      />
    </div>
  );
}
