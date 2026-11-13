"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type DayStatus = "disabled" | "green" | "yellow" | "red";
export type SlotOption = { start: string; end: string; reserved?: boolean };

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const ymd = (d: Date) => d.toLocaleDateString("sv-SE");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function monthMatrix(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const DOT: Record<Exclude<DayStatus, "disabled">, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-400",
};

export function SlotPicker({
  selectedDate,
  onSelectDate,
  getDayStatus,
  slots,
  selectedSlot,
  onSelectSlot,
  emptyState,
}: {
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  getDayStatus: (d: Date) => DayStatus;
  slots: SlotOption[];
  selectedSlot: string | null;
  onSelectSlot: (value: string) => void;
  /** Contenido a mostrar cuando el día elegido no tiene horarios */
  emptyState?: React.ReactNode;
}) {
  const [month, setMonth] = useState(() => {
    const base = selectedDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Si la fecha seleccionada cambia de mes desde fuera, mostramos ese mes
  useEffect(() => {
    if (!selectedDate) return;
    setMonth((m) =>
      m.getFullYear() === selectedDate.getFullYear() && m.getMonth() === selectedDate.getMonth()
        ? m
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    );
  }, [selectedDate]);

  const days = useMemo(() => monthMatrix(month), [month]);
  const todayKey = ymd(new Date());
  const selectedKey = selectedDate ? ymd(selectedDate) : null;
  const thisMonth = new Date();
  const canGoBack =
    month.getFullYear() > thisMonth.getFullYear() ||
    (month.getFullYear() === thisMonth.getFullYear() && month.getMonth() > thisMonth.getMonth()) ||
    // al editar una reserva pasada, permitimos volver a su mes
    (selectedDate !== null && selectedDate < month);

  const monthLabel = month.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const freeCount = slots.filter((s) => !s.reserved).length;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── Calendario ── */}
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              disabled={!canGoBack}
              aria-label="Mes anterior"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-semibold">{cap(monthLabel)}</p>
            <button
              type="button"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              aria-label="Mes siguiente"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-[11px] font-medium text-muted-foreground">
                {w}
              </span>
            ))}
            {days.map((d) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === month.getMonth();
              const status = getDayStatus(d);
              const isSelected = key === selectedKey;
              const isToday = key === todayKey;
              const unavailable = status === "disabled" || status === "red";
              const disabled = !inMonth || (status === "disabled" && !isSelected);
              return (
                <div key={key} className="flex justify-center">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectDate(d)}
                    aria-pressed={isSelected}
                    aria-label={d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                    className={cn(
                      "relative flex size-9 flex-col items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                      !inMonth && "invisible",
                      isSelected
                        ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                        : unavailable
                          ? "text-muted-foreground/50 hover:bg-muted"
                          : "text-foreground hover:bg-primary/10",
                      isToday && !isSelected && "font-semibold text-primary ring-1 ring-primary/40",
                      disabled && "cursor-default hover:bg-transparent"
                    )}
                  >
                    {d.getDate()}
                    {inMonth && status !== "disabled" && (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute bottom-1 size-1 rounded-full",
                          isSelected ? "bg-primary-foreground/80" : DOT[status]
                        )}
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500" />Libre</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" />Pocas horas</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-rose-400" />Completo o cerrado</span>
          </div>
        </div>

        {/* ── Horas ── */}
        <div className="flex flex-col border-t bg-muted/30 p-4 sm:border-l sm:border-t-0">
          {selectedDate ? (
            <>
              <div className="mb-3">
                <p className="text-sm font-semibold">
                  {cap(selectedDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {slots.length === 0
                    ? "Sin horarios este día"
                    : `${freeCount} de ${slots.length} ${slots.length === 1 ? "hora disponible" : "horas disponibles"}`}
                </p>
              </div>

              {slots.length === 0 && emptyState ? (
                emptyState
              ) : slots.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
                  <CalendarDays className="size-6 opacity-40" />
                  La sala no abre este día.
                  <span className="text-xs">Elige otra fecha en el calendario.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((s) => {
                    const value = `${s.start}-${s.end}`;
                    const isSelected = selectedSlot === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={s.reserved}
                        onClick={() => onSelectSlot(value)}
                        aria-pressed={isSelected}
                        className={cn(
                          "relative flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : s.reserved
                              ? "cursor-not-allowed border-dashed bg-transparent text-muted-foreground/60"
                              : "bg-card hover:border-primary/50 hover:bg-primary/5"
                        )}
                      >
                        <span className={cn("text-sm font-semibold tabular-nums", s.reserved && "line-through")}>
                          {s.start}
                        </span>
                        <span className={cn("text-[11px] tabular-nums", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {s.reserved ? "Ocupada" : `hasta ${s.end}`}
                        </span>
                        {isSelected && <Check className="absolute right-2 top-2 size-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Clock className="size-6 opacity-40" />
              Elige un día para ver las horas disponibles
            </div>
          )}
        </div>
      </div>

      {selectedDate && selectedSlot && (
        <div className="flex items-center gap-2 border-t bg-primary/5 px-4 py-2.5 text-sm">
          <Check className="size-4 text-primary" />
          <span className="text-muted-foreground">Sesión:</span>
          <span className="font-medium">
            {cap(selectedDate.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }))} ·{" "}
            {selectedSlot.replace("-", "–")}
          </span>
        </div>
      )}
    </div>
  );
}
