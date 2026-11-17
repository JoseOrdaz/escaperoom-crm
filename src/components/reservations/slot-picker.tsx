"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, CalendarDays, Clock, Info, Mail, Phone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DayStatus = "disabled" | "green" | "yellow" | "red";
/** Quién ocupa una franja (solo llega con sesión del CRM; el formulario público no lo recibe) */
export type SlotBooking = {
  start: string; end: string; customer?: string; email?: string; phone?: string; room?: string; linked?: boolean;
  status?: string; players?: number; language?: string; price?: number; notes?: string;
};
export type SlotOption = { start: string; end: string; reserved?: boolean; bookings?: SlotBooking[] };
/** Reserva del día (cualquier sala) para el resumen del día */
export type DayBooking = SlotBooking & { id: string; blocking?: boolean };

const STATUS_LABEL: Record<string, string> = { pendiente: "Pendiente", confirmada: "Confirmada", cancelada: "Cancelada" };
const LANG_LABEL: Record<string, string> = { es: "Español", en: "Inglés", ru: "Ruso" };

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

function BookingDetails({ b }: { b: SlotBooking }) {
  const st = b.status ?? "pendiente";
  return (
    <div>
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <p className="font-semibold">{b.customer || "Sin cliente"}</p>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", st === "confirmada" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700")}>{STATUS_LABEL[st]}</span>
      </div>
      <dl className="space-y-1.5 px-4 py-2 text-sm">
        {b.room && (
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sala</dt><dd className="text-right font-medium">{b.room}{b.linked && <span className="block text-xs font-normal text-amber-700">Sala vinculada: bloquea esta</span>}</dd></div>
        )}
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Hora</dt><dd className="font-medium tabular-nums">{b.start} – {b.end}</dd></div>
        {b.players ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Jugadores</dt><dd className="font-medium">{b.players}</dd></div> : null}
        {b.language && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Idioma</dt><dd className="font-medium">{LANG_LABEL[b.language] ?? b.language.toUpperCase()}</dd></div>}
        {b.price !== undefined && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Precio</dt><dd className="font-medium tabular-nums">{new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(b.price)}</dd></div>}
      </dl>
      {(b.email || b.phone) && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {b.phone && <a href={`tel:${b.phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"><Phone className="size-3.5" />{b.phone}</a>}
          {b.email && <a href={`mailto:${b.email}`} className="flex min-w-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"><Mail className="size-3.5 shrink-0" /><span className="truncate">{b.email}</span></a>}
        </div>
      )}
      {b.notes && <p className="mx-4 mb-3 whitespace-pre-line rounded-md bg-muted/50 px-3 py-2 text-xs">{b.notes}</p>}
    </div>
  );
}

export function SlotPicker({
  selectedDate,
  onSelectDate,
  getDayStatus,
  slots,
  selectedSlot,
  onSelectSlot,
  emptyState,
  dayBookings,
}: {
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  getDayStatus: (d: Date) => DayStatus;
  slots: SlotOption[];
  selectedSlot: string | null;
  onSelectSlot: (value: string) => void;
  /** Contenido a mostrar cuando el día elegido no tiene horarios */
  emptyState?: React.ReactNode;
  /** Reservas del día en todas las salas (solo CRM) */
  dayBookings?: DayBooking[];
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
                    const list = s.reserved ? s.bookings ?? [] : [];
                    if (list.some((x) => x.customer || x.room)) {
                      const first = list[0];
                      const anyPending = list.some((x) => (x.status ?? "pendiente") !== "confirmada");
                      return (
                        <Popover key={value}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "col-span-2 flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-left transition-colors hover:border-solid",
                                anyPending ? "border-amber-300 bg-amber-50/60 dark:bg-amber-500/10" : "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-500/10"
                              )}
                              aria-label={`Franja ${s.start} ocupada por ${list.length} ${list.length === 1 ? "reserva" : "reservas"}: ver detalles`}
                            >
                              <span className="pt-0.5 text-sm font-semibold tabular-nums text-muted-foreground line-through">{s.start}</span>
                              <span className="min-w-0 flex-1 text-xs leading-snug">
                                <span className="flex items-center gap-1.5 font-medium text-foreground">
                                  <span className="truncate">{first.customer || "Sin cliente"}</span>
                                  {list.length > 1 && <span className="shrink-0 rounded-full bg-foreground/10 px-1.5 text-[10px] font-semibold">+{list.length - 1} más</span>}
                                </span>
                                <span className="block truncate text-muted-foreground">
                                  {list.length > 1
                                    ? [...new Set(list.map((x) => x.room).filter(Boolean))].join(" · ")
                                    : [first.room && (first.linked ? `${first.room} (vinculada)` : first.room), first.players && `${first.players} jug.`, STATUS_LABEL[first.status ?? "pendiente"]].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                              <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="max-h-[70vh] w-80 overflow-y-auto p-0">
                            <p className="border-b px-4 py-2.5 text-xs text-muted-foreground">
                              {list.length === 1 ? "Reserva que ocupa esta franja" : `${list.length} reservas ocupan esta franja`}
                            </p>
                            <div className="divide-y">
                              {list.map((x, i) => <BookingDetails key={i} b={x} />)}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    }
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
                          {s.reserved ? "Reservada" : `hasta ${s.end}`}
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

      {selectedDate && dayBookings && dayBookings.length > 0 && (
        <div className="border-t">
          <p className="flex items-center justify-between gap-2 px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Reservas de este día en todas las salas</span>
            <span className="rounded-full bg-muted px-2 tabular-nums">{dayBookings.length}</span>
          </p>
          <ul className="max-h-64 divide-y overflow-y-auto px-2 pb-2">
            {dayBookings.map((b) => {
              const [selStart, selEnd] = selectedSlot?.split("-") ?? [];
              const overlapsSelected = !!selStart && b.start < selEnd && b.end > selStart;
              const st = b.status ?? "pendiente";
              return (
                <li key={b.id}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60",
                          overlapsSelected && "bg-primary/5"
                        )}
                      >
                        <span className={cn("h-8 w-1 shrink-0 rounded-full", st === "confirmada" ? "bg-emerald-500" : "bg-amber-500")} aria-hidden />
                        <span className="w-[86px] shrink-0 tabular-nums text-muted-foreground">{b.start}–{b.end}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{b.room ?? "Sala"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{b.customer || "Sin cliente"}{b.players ? ` · ${b.players} jug.` : ""}</span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            b.blocking ? "bg-rose-500/10 text-rose-700" : "bg-muted text-muted-foreground"
                          )}
                          title={b.blocking ? "Ocupa esta sala o una vinculada" : "Otra sala: no bloquea esta"}
                        >
                          {b.blocking ? "Bloquea" : "Otra sala"}
                        </span>
                        <Info className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 p-0">
                      <BookingDetails b={b} />
                    </PopoverContent>
                  </Popover>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
