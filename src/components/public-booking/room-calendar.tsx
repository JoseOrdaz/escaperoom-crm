"use client";

import { useMemo } from "react";
import { Phone } from "lucide-react";
import { priceFor } from "@/lib/pricing";
import type { RoomSchedule } from "@/lib/room-schedule";
import { cn } from "@/lib/utils";

export type CalendarRoom = {
  _id: string;
  name: string;
  priceTable: { players: number; price: number }[];
  capacityMin: number;
  schedule: RoomSchedule;
};
export type CalendarSlot = { start: string; end: string; free: boolean; taken: boolean };

/** Colores por precio (del más barato al más caro), como en las webs de escape rooms */
const TIERS = [
  "border-amber-300/70 bg-amber-50 text-amber-800",
  "border-emerald-300/70 bg-emerald-50 text-emerald-800",
  "border-sky-300/70 bg-sky-50 text-sky-800",
  "border-rose-300/70 bg-rose-50 text-rose-800",
  "border-violet-300/70 bg-violet-50 text-violet-800",
];
const DOT = ["bg-amber-400", "bg-emerald-500", "bg-sky-500", "bg-rose-500", "bg-violet-500"];
const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/**
 * Calendario de una sala: un bloque por día con sus sesiones (hora + precio).
 * Las sesiones reservadas salen apagadas; las pasadas o bloqueadas no salen.
 */
export function RoomCalendar({
  room, days, getSlots, onPick, phone, loading,
}: {
  room: CalendarRoom;
  days: string[];
  getSlots: (date: string) => { closed: boolean; slots: CalendarSlot[] };
  onPick: (date: string, start: string) => void;
  phone?: string;
  loading?: boolean;
}) {
  const minPlayers = room.priceTable?.length ? Math.min(...room.priceTable.map((p) => Number(p.players))) : room.capacityMin;

  const rows = useMemo(
    () =>
      days.map((date) => {
        const { closed, slots } = getSlots(date);
        return { date, closed, slots: slots.map((s) => ({ ...s, price: priceFor(room, minPlayers, date, s.start).price })) };
      }),
    [days, getSlots, room, minPlayers]
  );
  const prices = useMemo(() => [...new Set(rows.flatMap((r) => r.slots.map((s) => s.price)))].filter((p) => p > 0).sort((a, b) => a - b), [rows]);
  const tier = (p: number) => Math.min(prices.indexOf(p), TIERS.length - 1);

  return (
    <div className={cn("space-y-3 transition-opacity", loading && "opacity-60")}>
      {prices.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Precio por grupo desde:</span>
          {prices.map((p) => (
            <span key={p} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", TIERS[tier(p)])}>{eur(p)}</span>
          ))}
          <span className="text-xs text-muted-foreground">({minPlayers} jugadores; el precio final depende de cuántos seáis)</span>
        </div>
      )}

      {rows.map(({ date, closed, slots }) => {
        const d = new Date(`${date}T00:00:00`);
        return (
          <section key={date} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:gap-6">
            <p className="shrink-0 sm:w-36">
              <span className="text-2xl font-semibold tabular-nums">{d.getDate()}</span>{" "}
              <span className="text-sm">{d.toLocaleDateString("es-ES", { month: "long" })},</span>{" "}
              <span className="text-sm font-medium text-primary">{d.toLocaleDateString("es-ES", { weekday: "short" })}</span>
            </p>
            {closed || slots.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:pt-2">
                No hay sesiones online este día
                {phone && <> · <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 font-medium text-primary"><Phone className="size-3.5" />Llámanos</a></>}
              </p>
            ) : (
              <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {slots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    disabled={!s.free}
                    onClick={() => onPick(date, s.start)}
                    aria-label={s.free ? `Reservar el ${date} a las ${s.start}, desde ${eur(s.price)}` : `${s.start} reservada`}
                    className={cn(
                      "flex flex-col items-center rounded-xl border px-2 py-2 transition-all",
                      s.free ? cn(TIERS[tier(s.price)], "hover:-translate-y-0.5 hover:shadow-md") : "cursor-not-allowed border-transparent bg-muted/60 text-muted-foreground/40"
                    )}
                  >
                    <span className={cn("text-base font-semibold tabular-nums leading-tight", s.free && "text-foreground/90")}>{s.start}</span>
                    <span className="flex items-center gap-1 text-xs font-medium">
                      {s.free ? <><span className={cn("size-1.5 rounded-full", DOT[tier(s.price)])} />{eur(s.price)}</> : "Reservada"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
