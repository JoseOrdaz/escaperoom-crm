"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, Phone, UsersRound } from "lucide-react";
import BookingWizard from "@/components/bookings";
import { RoomCalendar } from "./room-calendar";
import { blockFor, dayPlan, type RoomSchedule } from "@/lib/room-schedule";
import { escapeOfRoom, type Escape } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * Módulo de reservas para clientes (se incrusta como iframe en la web de cada escape).
 * Primero: día + horas libres de cada sala. Al pulsar una hora → formulario con todo elegido.
 */

type Room = {
  _id: string;
  name: string;
  escape: string;
  imageUrl?: string;
  durationMinutes: number;
  capacityMin: number;
  capacityMax: number;
  priceTable: { players: number; price: number }[];
  linkedRooms?: string[];
  schedule: RoomSchedule;
};
type Busy = { roomId: string; start: string; end: string };

export const BRAND_THEME: Record<Escape, { primary: string; ring: string; name: string; logo: string; logoBg: string }> = {
  Fobia: { primary: "#3f51b5", ring: "#5c6bc0", name: "Fobia Escape Rooms", logo: "/brand/fobia.png", logoBg: "#1a1d35" },
  "Action Gates": { primary: "#00806f", ring: "#00a884", name: "Action Gates", logo: "/brand/action-gates.svg", logoBg: "#10201d" },
};

const DAYS_SHOWN = 7;
const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Avisa a la página que contiene el iframe: altura del contenido y cuándo subir al inicio */
function postToParent(msg: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.parent !== window) window.parent.postMessage({ source: "escape-crm", ...msg }, "*");
}

const slug = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type Range = "week" | "today" | "tomorrow" | "after";

/**
 * @param initialRoom id o nombre de sala (?sala=…): muestra solo el calendario de esa sala,
 *   pensado para incrustarlo en la página de cada sala de la web.
 */
export function PublicBooking({ escape, initialRoom }: { escape: Escape; initialRoom?: string }) {
  const theme = BRAND_THEME[escape];
  const rootRef = useRef<HTMLDivElement>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [phone, setPhone] = useState("");
  const [from, setFrom] = useState(today0);
  const [day, setDay] = useState(() => ymd(today0()));
  const [busy, setBusy] = useState<Busy[]>([]);
  const [loadingBusy, setLoadingBusy] = useState(false);
  const [busyLoaded, setBusyLoaded] = useState(false);
  const [view, setView] = useState<"schedule" | "form">("schedule");
  const [preset, setPreset] = useState<{ roomId: string; date: string; slot: string; key: number } | null>(null);
  const [mode, setMode] = useState<"calendar" | "day">("calendar");
  const [calRoomId, setCalRoomId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("week");

  // Altura automática del iframe
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const send = () => postToParent({ type: "height", height: Math.ceil(el.getBoundingClientRect().height) });
    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scrollTop = useCallback(() => {
    postToParent({ type: "scrollTop" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((all: Room[]) => {
        const mine = all.filter((r) => escapeOfRoom(r) === escape);
        const wanted = initialRoom ? slug(initialRoom) : "";
        const match = wanted ? mine.find((r) => r._id === initialRoom || slug(r.name) === wanted || slug(r.name).includes(wanted)) : undefined;
        setRooms(match ? [match] : mine);
        setCalRoomId((match ?? mine[0])?._id ?? null);
      })
      .catch(() => setRooms([]));
    fetch("/api/settings").then((r) => r.json()).then((j) => setPhone(j?.escapes?.[escape]?.phone ?? "")).catch(() => {});
  }, [escape, initialRoom]);

  // Horas ocupadas de las salas del escape (y sus vinculadas) en los días visibles
  const roomKey = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rooms ?? []) { ids.add(r._id); (r.linkedRooms ?? []).forEach((id) => ids.add(id)); }
    return [...ids].join(",");
  }, [rooms]);
  useEffect(() => {
    if (!roomKey) return;
    setLoadingBusy(true);
    fetch(`/api/reservations?from=${ymd(from)}&to=${ymd(addDays(from, DAYS_SHOWN))}&forCalendar=1&roomIds=${roomKey}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setBusy(Array.isArray(j) ? j : []))
      .catch(() => setBusy([]))
      .finally(() => { setLoadingBusy(false); setBusyLoaded(true); });
  }, [from, roomKey]);

  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => ymd(addDays(from, i))), [from]);
  const now = new Date();
  const nowYmd = ymd(now);
  const nowHM = `${p2(now.getHours())}:${p2(now.getMinutes())}`;

  /** Horas de una sala un día, con su estado */
  const slotsOf = useCallback((room: Room, date: string) => {
    const plan = dayPlan(room.schedule, date);
    const ids = new Set([room._id, ...(room.linkedRooms ?? [])]);
    const dayBusy = busy.filter((b) => ids.has(b.roomId) && b.start.slice(0, 10) === date);
    return {
      closed: plan.kind === "closed",
      slots: plan.slots.map((s) => {
        const taken = dayBusy.some((b) => b.start.slice(11, 16) < s.end && b.end.slice(11, 16) > s.start);
        const blocked = !!blockFor(plan.blocks, date, s);
        const past = date < nowYmd || (date === nowYmd && s.start <= nowHM);
        return { ...s, free: !taken && !blocked && !past, taken };
      }).filter((s) => !(s.free === false && !s.taken)), // las bloqueadas o pasadas no se muestran
    };
  }, [busy, nowYmd, nowHM]);

  const freeByDay = useMemo(() => {
    const m: Record<string, { free: number; total: number }> = {};
    for (const d of days) {
      const all = (rooms ?? []).flatMap((r) => slotsOf(r, d).slots);
      m[d] = { free: all.filter((s) => s.free).length, total: all.length };
    }
    return m;
  }, [days, rooms, slotsOf]);

  // Al abrir, saltar al primer día con horas libres
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || loadingBusy || !busyLoaded || !rooms?.length) return;
    const first = days.find((d) => freeByDay[d]?.free);
    if (first) { autoPicked.current = true; setDay(first); }
  }, [days, freeByDay, loadingBusy, busyLoaded, rooms]);

  const style = { "--primary": theme.primary, "--ring": theme.ring } as CSSProperties;
  const canGoBack = from > today0();
  const calRoom = rooms?.find((r) => r._id === calRoomId) ?? rooms?.[0] ?? null;
  const calDays = range === "week" ? days : [ymd(addDays(today0(), range === "today" ? 0 : range === "tomorrow" ? 1 : 2))];
  const pick = (roomId: string, date: string, start: string) => {
    setPreset({ roomId, date, slot: start, key: Date.now() });
    setView("form");
    scrollTop();
  };
  const chooseRange = (r: Range) => {
    setRange(r);
    if (r !== "week" && ymd(from) !== ymd(today0())) setFrom(today0());
  };
  const moveWeek = (n: number) => {
    const f = addDays(from, n * DAYS_SHOWN);
    const t = today0();
    const nf = f < t ? t : f;
    setFrom(nf);
    setDay(ymd(nf));
    setRange("week");
  };

  return (
    <div ref={rootRef} style={style} className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      {view === "form" ? (
        <div className="space-y-4">
          <button type="button" onClick={() => { setView("schedule"); scrollTop(); }} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="size-4" /> Ver todos los horarios
          </button>
          <BookingWizard roomsProp={rooms ?? undefined} contactPhone={phone} preset={preset} onStepChange={scrollTop} />
        </div>
      ) : (
        <div className="space-y-6">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reserva tu experiencia</h1>
              <p className="mt-1 text-muted-foreground">Elige una sesión libre. Te pediremos los datos en el siguiente paso.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {rooms && rooms.length > 1 && (
                <div className="inline-flex rounded-xl bg-muted p-1 text-sm">
                  {([["calendar", "Calendario"], ["day", "Por día"]] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setMode(v)} className={cn("rounded-lg px-3 py-1.5 font-medium", mode === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => { setPreset(null); setView("form"); scrollTop(); }} className="text-sm font-medium text-primary hover:underline">
                Paso a paso
              </button>
            </div>
          </header>

          {mode === "calendar" || (rooms && rooms.length === 1) ? (
            <div className="space-y-5">
              {/* Salas */}
              {rooms && rooms.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {rooms.map((r) => (
                    <button key={r._id} type="button" onClick={() => setCalRoomId(r._id)} aria-pressed={calRoom?._id === r._id} className={cn("flex shrink-0 items-center gap-2 rounded-xl border bg-card p-1.5 pr-3 text-sm font-medium transition-colors", calRoom?._id === r._id ? "border-primary ring-1 ring-primary" : "hover:border-primary/40")}>
                      {r.imageUrl ? <img src={r.imageUrl} alt="" className="size-9 rounded-lg object-cover" /> : <span className="size-9 rounded-lg bg-muted" />}
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
              {calRoom && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="text-lg font-semibold text-foreground">{calRoom.name}</span>
                  <span className="flex items-center gap-1"><UsersRound className="size-3.5" />{calRoom.capacityMin}–{calRoom.capacityMax} jugadores</span>
                  <span className="flex items-center gap-1"><Clock className="size-3.5" />{calRoom.durationMinutes} min</span>
                </div>
              )}

              {/* Periodo */}
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium hover:border-primary/40">
                  <CalendarDays className="size-4" />
                  <span className="sr-only">Elegir fecha</span>
                  <input
                    type="date"
                    min={ymd(today0())}
                    value={ymd(from)}
                    onChange={(e) => { if (e.target.value) { setFrom(new Date(`${e.target.value}T00:00:00`)); setDay(e.target.value); setRange("week"); } }}
                    className="bg-transparent outline-none"
                  />
                </label>
                {([["week", "Semana"], ["today", "Hoy"], ["tomorrow", "Mañana"], ["after", "Pasado mañana"]] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => chooseRange(v)} className={cn("h-10 rounded-full border px-4 text-sm font-medium transition-colors", range === v ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}>{l}</button>
                ))}
                {range === "week" && (
                  <span className="ml-auto flex items-center gap-1">
                    <button type="button" aria-label="Semana anterior" disabled={!canGoBack} onClick={() => moveWeek(-1)} className="flex size-10 items-center justify-center rounded-full border bg-card disabled:opacity-30"><ChevronLeft className="size-5" /></button>
                    <button type="button" aria-label="Semana siguiente" onClick={() => moveWeek(1)} className="flex size-10 items-center justify-center rounded-full border bg-card"><ChevronRight className="size-5" /></button>
                  </span>
                )}
              </div>

              {!calRoom ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
              ) : (
                <RoomCalendar
                  room={calRoom}
                  days={calDays}
                  getSlots={(date) => slotsOf(calRoom, date)}
                  onPick={(date, start) => pick(calRoom._id, date, start)}
                  phone={phone}
                  loading={loadingBusy}
                />
              )}
            </div>
          ) : (
          <>
          {/* Días */}
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Días anteriores" disabled={!canGoBack} onClick={() => { const f = addDays(from, -DAYS_SHOWN); const t = today0(); const nf = f < t ? t : f; setFrom(nf); setDay(ymd(nf)); }} className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-card disabled:opacity-30">
              <ChevronLeft className="size-5" />
            </button>
            <div className="grid flex-1 grid-cols-7 gap-1.5 overflow-x-auto">
              {days.map((d) => {
                const date = new Date(`${d}T00:00:00`);
                const n = freeByDay[d]?.free ?? 0;
                const none = !freeByDay[d]?.total;
                const sel = d === day;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDay(d)}
                    aria-pressed={sel}
                    className={cn("flex min-w-[52px] flex-col items-center rounded-xl border px-1 py-2 transition-colors", sel ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card hover:border-primary/50")}
                  >
                    <span className={cn("text-[11px] uppercase", sel ? "opacity-90" : "text-muted-foreground")}>{d === nowYmd ? "Hoy" : date.toLocaleDateString("es-ES", { weekday: "short" })}</span>
                    <span className="text-lg font-semibold leading-tight">{date.getDate()}</span>
                    <span className={cn("text-[10px]", sel ? "opacity-90" : n ? "text-emerald-700" : "text-muted-foreground")}>{loadingBusy ? "…" : n ? `${n} libres` : none ? "Cerrado" : "Completo"}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" aria-label="Días siguientes" onClick={() => { const f = addDays(from, DAYS_SHOWN); setFrom(f); setDay(ymd(f)); }} className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-card">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-primary" />
            {(() => { const t = new Date(`${day}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }); return t.charAt(0).toUpperCase() + t.slice(1); })()}
            {loadingBusy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </p>

          {/* Salas del día */}
          {!rooms ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {rooms.map((room) => {
                const { closed, slots } = slotsOf(room, day);
                const free = slots.filter((s) => s.free).length;
                const minPrice = room.priceTable?.length ? Math.min(...room.priceTable.map((p) => Number(p.price))) : null;
                return (
                  <article key={room._id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <div className="flex gap-4 p-4">
                      {room.imageUrl ? (
                        <img src={room.imageUrl} alt="" className="size-20 shrink-0 rounded-xl object-cover sm:size-24" />
                      ) : (
                        <span className="size-20 shrink-0 rounded-xl bg-muted sm:size-24" />
                      )}
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold leading-tight">{room.name}</h2>
                        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><UsersRound className="size-3.5" />{room.capacityMin}–{room.capacityMax} jugadores</span>
                          <span className="flex items-center gap-1"><Clock className="size-3.5" />{room.durationMinutes} min</span>
                        </p>
                        {minPrice !== null && <p className="mt-1 text-sm">Desde <span className="font-semibold">{eur(minPrice)}</span> <span className="text-muted-foreground">por grupo</span></p>}
                      </div>
                    </div>
                    <div className="border-t bg-muted/30 p-4">
                      {closed || slots.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay reservas online este día{phone ? <> · <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 font-medium text-primary"><Phone className="size-3.5" />{phone}</a></> : null}</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {slots.map((s) => (
                              <button
                                key={s.start}
                                type="button"
                                disabled={!s.free}
                                onClick={() => pick(room._id, day, s.start)}
                                className={cn(
                                  "min-w-[68px] rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums transition-colors",
                                  s.free ? "border-primary/40 bg-card text-primary hover:bg-primary hover:text-primary-foreground" : "cursor-not-allowed border-transparent bg-muted text-muted-foreground/60 line-through"
                                )}
                                aria-label={s.free ? `Reservar ${room.name} a las ${s.start}` : `${s.start} reservada`}
                              >
                                {s.start}
                              </button>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{free ? `${free} ${free === 1 ? "hora libre" : "horas libres"}` : "Todo reservado este día"}</p>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          </>
          )}
        </div>
      )}
    </div>
  );
}
