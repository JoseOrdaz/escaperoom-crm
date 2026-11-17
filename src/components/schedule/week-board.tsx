"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Lock, Sparkles, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blockFor, dayPlan, type RoomSchedule, type TimeBlock, type TimeSlot } from "@/lib/room-schedule";
import type { PriceRule } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type BoardRoom = {
  _id: string;
  name: string;
  escape: string;
  imageUrl?: string;
  durationMinutes: number;
  linkedRooms?: string[];
  schedule: RoomSchedule;
};
export type BoardBooking = {
  _id: string;
  roomId: string;
  start: string;
  end: string;
  players: number;
  status: string;
  customer?: { name?: string } | null;
};
export type SlotInfo = {
  room: BoardRoom;
  date: string;
  slot: TimeSlot;
  booking: BoardBooking | null;
  /** Ocupada por una reserva de una sala vinculada (espacio compartido) */
  linked: boolean;
  /** Franja bloqueada desde «Horarios y precios» */
  blocked: TimeBlock | null;
  past: boolean;
};

const p2 = (n: number) => String(n).padStart(2, "0");
export const ymdLocal = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const mondayOf = (d: Date) => {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Reglas de precio de ese día (todo el día o por franjas) */
const rulesOn = (s: RoomSchedule, ymd: string): PriceRule[] => (s.priceRules ?? []).filter((r) => r.date === ymd);
const ruleText = (r: PriceRule) => `${r.value > 0 ? "+" : ""}${r.value}${r.adjustType === "percent" ? "%" : "€"}`;

/** Salas + reservas (no canceladas) de la semana */
export function useWeekBoard(initial = new Date()) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(initial));
  const [rooms, setRooms] = useState<BoardRoom[]>([]);
  const [bookings, setBookings] = useState<BoardBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRooms = useCallback(async () => {
    const r = await fetch("/api/rooms", { cache: "no-store" }).then((x) => x.json()).catch(() => []);
    setRooms(Array.isArray(r) ? r : []);
  }, []);
  const roomKey = rooms.map((r) => r._id).join(",");
  const loadBookings = useCallback(async () => {
    if (!roomKey) return;
    setLoading(true);
    try {
      const from = ymdLocal(weekStart);
      const to = ymdLocal(addDays(weekStart, 7));
      // Con roomIds funciona también sin sesión (solo horas ocupadas, sin datos de clientes)
      const r = await fetch(`/api/reservations?from=${from}&to=${to}&forCalendar=1&roomIds=${roomKey}`, { cache: "no-store" }).then((x) => x.json());
      setBookings(Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []);
    } finally {
      setLoading(false);
    }
  }, [weekStart, roomKey]);

  useEffect(() => { loadRooms(); }, [loadRooms]);
  useEffect(() => { loadBookings(); }, [loadBookings]);

  return {
    weekStart, setWeekStart, rooms, bookings, loading,
    reload: async () => { await Promise.all([loadRooms(), loadBookings()]); },
  };
}

export function WeekNav({ weekStart, onChange, loading }: { weekStart: Date; onChange: (d: Date) => void; loading?: boolean }) {
  const end = addDays(weekStart, 6);
  const fmt = (d: Date, y = false) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short", ...(y ? { year: "numeric" } : {}) });
  const isThisWeek = ymdLocal(mondayOf(new Date())) === ymdLocal(weekStart);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => onChange(addDays(weekStart, -7))}><ChevronLeft className="size-4" /></Button>
      <Button variant="outline" size="icon" aria-label="Semana siguiente" onClick={() => onChange(addDays(weekStart, 7))}><ChevronRight className="size-4" /></Button>
      <Button variant="outline" disabled={isThisWeek} onClick={() => onChange(mondayOf(new Date()))}>Hoy</Button>
      <input
        type="date"
        aria-label="Ir a la semana del día"
        className="h-9 rounded-md border bg-card px-2 text-sm"
        value={ymdLocal(weekStart)}
        onChange={(e) => e.target.value && onChange(mondayOf(new Date(`${e.target.value}T00:00:00`)))}
      />
      <span className="font-semibold">{fmt(weekStart)} – {fmt(end, true)}</span>
      {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

export function WeekBoard({
  rooms,
  bookings,
  weekStart,
  onSlotClick,
  onDayClick,
  showPrices = true,
  publicView = false,
}: {
  rooms: BoardRoom[];
  bookings: BoardBooking[];
  weekStart: Date;
  onSlotClick?: (info: SlotInfo) => void;
  onDayClick?: (room: BoardRoom, date: string) => void;
  showPrices?: boolean;
  /** Vista para clientes: sin nombres ni estados, todo lo ocupado sale como «Reservada» */
  publicView?: boolean;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = ymdLocal(new Date());
  const nowHM = `${p2(new Date().getHours())}:${p2(new Date().getMinutes())}`;
  const byRoomDay = useMemo(() => {
    const m = new Map<string, BoardBooking[]>();
    for (const b of bookings) {
      if (b.status === "cancelada") continue;
      const k = `${b.roomId}|${b.start.slice(0, 10)}`;
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return m;
  }, [bookings]);

  if (!rooms.length) return <p className="py-10 text-center text-sm text-muted-foreground">No hay salas activas.</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full min-w-[1100px] table-fixed border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 w-44 bg-muted px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sala</th>
            {days.map((d) => {
              const k = ymdLocal(d);
              return (
                <th key={k} className={cn("border-l px-2 py-2 text-center font-medium", k === today && "bg-primary/10 text-primary")}>
                  <span className="block text-xs uppercase text-muted-foreground">{d.toLocaleDateString("es-ES", { weekday: "short" })}</span>
                  {d.getDate()} {d.toLocaleDateString("es-ES", { month: "short" })}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room._id} className="border-t align-top">
              <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-3 text-left font-medium">
                <span className="flex items-center gap-2">
                  {room.imageUrl ? <img src={room.imageUrl} alt="" className="size-8 shrink-0 rounded-md object-cover" /> : <span className="size-8 shrink-0 rounded-md bg-muted" />}
                  <span className="min-w-0">
                    <span className="block truncate">{room.name}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">{room.escape}</span>
                  </span>
                </span>
              </th>
              {days.map((d) => {
                const ymd = ymdLocal(d);
                const plan = dayPlan(room.schedule, ymd);
                const rules = showPrices ? rulesOn(room.schedule, ymd) : [];
                const own = byRoomDay.get(`${room._id}|${ymd}`) ?? [];
                const linked = (room.linkedRooms ?? []).flatMap((id) => byRoomDay.get(`${id}|${ymd}`) ?? []);
                const isPastDay = ymd < today;
                return (
                  <td key={ymd} className={cn("border-l p-1.5", ymd === today && "bg-primary/[0.03]", plan.kind === "closed" && "bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(0,0,0,0.035)_6px,rgba(0,0,0,0.035)_12px)]")}>
                    {!publicView && (onDayClick || plan.kind !== "normal" || rules.length > 0 || plan.blocks.length > 0) && (
                      <button
                        type="button"
                        disabled={!onDayClick}
                        onClick={() => onDayClick?.(room, ymd)}
                        className={cn("mb-1 flex w-full flex-wrap items-center gap-1 rounded-md px-1 py-0.5 text-left text-[11px]", onDayClick && "hover:bg-muted")}
                        title={onDayClick ? "Gestionar este día" : undefined}
                      >
                        {plan.kind === "closed" && <span className="flex items-center gap-1 rounded bg-rose-500/10 px-1.5 font-medium text-rose-700"><Lock className="size-3" />Cerrado</span>}
                        {plan.kind !== "closed" && plan.blocks.length > 0 && <span className="flex items-center gap-1 rounded bg-slate-500/10 px-1.5 font-medium text-slate-700"><Lock className="size-3" />{plan.blocks.map((b) => `${b.start}–${b.end}`).join(", ")}</span>}
                        {plan.kind === "special" && <span className="flex items-center gap-1 rounded bg-violet-500/10 px-1.5 font-medium text-violet-700"><Sparkles className="size-3" />Especial</span>}
                        {rules.map((r, i) => (
                          <span key={i} className="flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 font-medium text-amber-800" title={`${r.label || "Precio especial"}${r.start ? ` ${r.start}–${r.end}` : ""}`}>
                            <Tag className="size-3" />{ruleText(r)}{r.start ? ` ${r.start}` : ""}
                          </span>
                        ))}
                        {onDayClick && plan.kind === "normal" && rules.length === 0 && plan.blocks.length === 0 && <span className="text-muted-foreground/60">Gestionar…</span>}
                      </button>
                    )}
                    {plan.kind === "closed" ? (
                      <p className="px-1 text-[11px] text-muted-foreground">{publicView ? "Cerrado" : plan.reason || "Sin reservas"}</p>
                    ) : plan.slots.length === 0 ? (
                      <p className="px-1 text-[11px] text-muted-foreground">Sin horario</p>
                    ) : (
                      <div className="grid gap-1">
                        {plan.slots.map((slot) => {
                          const overlaps = (b: BoardBooking) => b.start.slice(11, 16) < slot.end && b.end.slice(11, 16) > slot.start;
                          const booking = own.find(overlaps) ?? null;
                          const linkedBooking = !booking ? linked.find(overlaps) ?? null : null;
                          const past = isPastDay || (ymd === today && slot.start <= nowHM);
                          const blocked = blockFor(plan.blocks, ymd, slot);
                          const busy = booking ?? linkedBooking;
                          const info: SlotInfo = { room, date: ymd, slot, booking: busy, linked: !!linkedBooking, blocked, past };
                          const label = busy
                            ? (!publicView && booking?.customer?.name?.split(" ")[0]) || "Reservada"
                            : blocked ? (publicView ? "No disponible" : "Bloqueada") : past ? "—" : "Libre";
                          const pending = !publicView && booking?.status === "pendiente";
                          return (
                            <button
                              key={slot.start}
                              type="button"
                              disabled={!onSlotClick}
                              onClick={() => onSlotClick?.(info)}
                              title={
                                publicView
                                  ? busy ? "Reservada" : blocked ? "No disponible" : past ? "Hora pasada" : "Libre: pulsa para reservar"
                                  : booking ? `${booking.customer?.name ?? "Reserva"} · ${booking.players} jugadores${booking.status === "pendiente" ? " · pendiente" : ""}`
                                  : linkedBooking ? `Reservada (espacio compartido)${linkedBooking.customer?.name ? ` · ${linkedBooking.customer.name}` : ""}`
                                  : blocked ? `Bloqueada ${blocked.start}–${blocked.end}${blocked.reason ? ` · ${blocked.reason}` : ""}`
                                  : past ? "Hora pasada" : "Libre"
                              }
                              className={cn(
                                "flex items-center justify-between gap-1 rounded-md border px-1.5 py-1 text-left text-xs transition-colors",
                                busy && (pending ? "border-amber-300 bg-amber-100/70 text-amber-900" : "border-primary/30 bg-primary/15 text-primary"),
                                !busy && blocked && "border-transparent bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(0,0,0,0.05)_4px,rgba(0,0,0,0.05)_8px)] text-muted-foreground",
                                !busy && !blocked && !past && "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
                                !busy && !blocked && past && "border-transparent bg-muted/40 text-muted-foreground/60",
                                onSlotClick && "cursor-pointer"
                              )}
                            >
                              <span className="font-semibold tabular-nums">{slot.start}</span>
                              <span className="flex min-w-0 items-center gap-1 truncate">{!busy && blocked && <Lock className="size-3 shrink-0" />}{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BoardLegend({ publicView = false }: { publicView?: boolean }) {
  const item = (cls: string, label: string) => (
    <span className="flex items-center gap-1.5"><span className={cn("size-3 rounded border", cls)} />{label}</span>
  );
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {item("border-emerald-300 bg-emerald-50", "Libre")}
      {item("border-primary/30 bg-primary/15", "Reservada")}
      {!publicView && item("border-amber-300 bg-amber-100", "Pendiente")}
      <span className="flex items-center gap-1.5"><Lock className="size-3" />{publicView ? "No disponible" : "Bloqueada / cerrado"}</span>
      {!publicView && <span className="flex items-center gap-1.5"><Sparkles className="size-3 text-violet-700" />Horario especial</span>}
      {!publicView && <span className="flex items-center gap-1.5"><Tag className="size-3 text-amber-800" />Precio especial</span>}
    </div>
  );
}
