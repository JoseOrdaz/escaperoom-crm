"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Lock, Settings2, Sparkles, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BoardLegend, WeekBoard, WeekNav, ymdLocal, useWeekBoard, type BoardRoom } from "@/components/schedule/week-board";
import { slotsToText } from "@/lib/room-schedule";
import { ScheduleActionDialog, type ActionTab } from "./_components/schedule-action-dialog";
import { cn } from "@/lib/utils";

type Exception = {
  key: string;
  date: string;
  kind: "closed" | "blocked" | "special" | "price";
  detail: string;
  rooms: BoardRoom[];
  undo: Record<string, unknown>;
};

export default function SchedulesPage() {
  const board = useWeekBoard();
  const [escape, setEscape] = useState("all");
  const [dialog, setDialog] = useState<{ roomIds: string[]; date: string; tab?: ActionTab } | null>(null);

  const escapes = [...new Set(board.rooms.map((r) => r.escape))];
  const rooms = board.rooms.filter((r) => escape === "all" || r.escape === escape);

  // Próximos cierres, horarios y precios especiales (agrupando salas con el mismo cambio)
  const exceptions = useMemo(() => {
    const today = ymdLocal(new Date());
    const m = new Map<string, Exception>();
    const add = (e: Omit<Exception, "rooms">, room: BoardRoom) => {
      const cur = m.get(e.key) ?? { ...e, rooms: [] };
      cur.rooms.push(room);
      m.set(e.key, cur);
    };
    for (const r of rooms) {
      for (const d of r.schedule.daysOff ?? []) if (d.date >= today) add({ key: `c|${d.date}|${d.reason}`, date: d.date, kind: "closed", detail: d.reason || "Cerrado", undo: { action: "reopen" } }, r);
      for (const b of r.schedule.blocks ?? []) if (b.date >= today) add({ key: `b|${b.date}|${b.start}|${b.end}|${b.reason}`, date: b.date, kind: "blocked", detail: `De ${b.start} a ${b.end}${b.reason ? ` · ${b.reason}` : ""}`, undo: { action: "reopen", start: b.start, end: b.end } }, r);
      for (const o of r.schedule.overrides ?? []) if (o.date >= today) add({ key: `s|${o.date}|${slotsToText(o.slots)}`, date: o.date, kind: "special", detail: slotsToText(o.slots), undo: { action: "normal" } }, r);
      for (const p of r.schedule.priceRules ?? []) {
        if (p.date < today) continue;
        const amount = `${p.value > 0 ? "+" : ""}${p.value}${p.adjustType === "percent" ? " %" : " €"}`;
        add({
          key: `p|${p.date}|${p.start ?? ""}|${p.end ?? ""}|${amount}|${p.label}`, date: p.date, kind: "price",
          detail: `${p.label || "Precio especial"} ${amount}${p.start ? ` (${p.start}–${p.end})` : ""}`,
          undo: { action: "removePrice", ...(p.start ? { start: p.start, end: p.end } : {}) },
        }, r);
      }
    }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [rooms]);

  async function undo(e: Exception) {
    const res = await fetch("/api/rooms/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomIds: e.rooms.map((r) => r._id), dates: [e.date], ...e.undo }),
    });
    if (res.ok) {
      toast.success("Cambio quitado");
      board.reload();
    } else toast.error("No se pudo quitar");
  }

  const KIND = {
    closed: { icon: Lock, label: "Cerrado", cls: "bg-rose-500/10 text-rose-700" },
    blocked: { icon: Lock, label: "Horas bloqueadas", cls: "bg-slate-500/10 text-slate-700" },
    special: { icon: Sparkles, label: "Horario especial", cls: "bg-violet-500/10 text-violet-700" },
    price: { icon: Tag, label: "Precio especial", cls: "bg-amber-500/10 text-amber-800" },
  } as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><CalendarClock className="size-6 text-primary" /> Horarios y precios</h1>
          <p className="text-sm text-muted-foreground">Todas las salas en una semana: cierra días, pon horarios o precios especiales y mira las reservas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialog({ roomIds: rooms.map((r) => r._id), date: ymdLocal(new Date()), tab: "close" })}><Lock className="size-4" /> Bloquear reservas</Button>
          <Button variant="outline" onClick={() => setDialog({ roomIds: rooms.map((r) => r._id), date: ymdLocal(new Date()), tab: "price" })}><Tag className="size-4" /> Precio especial</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekNav weekStart={board.weekStart} onChange={board.setWeekStart} loading={board.loading} />
        {escapes.length > 1 && (
          <div className="inline-flex rounded-xl bg-muted p-1 text-sm">
            {["all", ...escapes].map((e) => (
              <button key={e} type="button" onClick={() => setEscape(e)} className={cn("rounded-lg px-3 py-1.5 font-medium", escape === e ? "bg-card shadow-sm" : "text-muted-foreground")}>{e === "all" ? "Todos" : e}</button>
            ))}
          </div>
        )}
      </div>

      <WeekBoard
        rooms={rooms}
        bookings={board.bookings}
        weekStart={board.weekStart}
        onDayClick={(room, date) => setDialog({ roomIds: [room._id], date })}
        onSlotClick={({ room, date }) => setDialog({ roomIds: [room._id], date })}
      />
      <BoardLegend />

      <section className="rounded-2xl border bg-card shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Próximos cambios</h2>
            <p className="text-sm text-muted-foreground">Cierres, horarios especiales y precios especiales a partir de hoy.</p>
          </div>
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard/rooms"><Settings2 className="size-4" /> Horario habitual y tarifas de cada sala</Link></Button>
        </header>
        {exceptions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay cambios programados.</p>
        ) : (
          <ul className="divide-y">
            {exceptions.map((e) => {
              const k = KIND[e.kind];
              return (
                <li key={e.key} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-36 shrink-0 font-medium capitalize">{new Date(`${e.date}T00:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", k.cls)}><k.icon className="size-3" />{k.label}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{e.detail}</span>
                    <span className="block text-xs text-muted-foreground">{e.rooms.length === rooms.length && rooms.length > 1 ? "Todas las salas" : e.rooms.map((r) => r.name).join(", ")}</span>
                  </span>
                  <Button variant="ghost" size="sm" className="text-rose-700" onClick={() => undo(e)}><Trash2 className="size-4" /> Quitar</Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dialog && (
        <ScheduleActionDialog
          open={!!dialog}
          onOpenChange={(o) => !o && setDialog(null)}
          rooms={rooms}
          initial={dialog}
          onDone={() => { setDialog(null); board.reload(); }}
        />
      )}
    </div>
  );
}
