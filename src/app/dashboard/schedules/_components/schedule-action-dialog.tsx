"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Sparkles, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BoardRoom } from "@/components/schedule/week-board";
import { datesBetween, dayPlan, parseSlots, slotsToText, type Weekday } from "@/lib/room-schedule";
import { cn } from "@/lib/utils";

export type ActionTab = "close" | "special" | "price";
const WD: { v: Weekday; l: string }[] = [
  { v: "monday", l: "L" }, { v: "tuesday", l: "M" }, { v: "wednesday", l: "X" }, { v: "thursday", l: "J" },
  { v: "friday", l: "V" }, { v: "saturday", l: "S" }, { v: "sunday", l: "D" },
];

export function ScheduleActionDialog({
  open, onOpenChange, rooms, initial, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rooms: BoardRoom[];
  initial: { roomIds: string[]; date: string; tab?: ActionTab };
  onDone: () => void;
}) {
  const [tab, setTab] = useState<ActionTab>("close");
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [slotsText, setSlotsText] = useState("");
  const [adjustType, setAdjustType] = useState<"percent" | "amount">("amount");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [timed, setTimed] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [closeHours, setCloseHours] = useState(false);
  const [closeStart, setCloseStart] = useState("");
  const [closeEnd, setCloseEnd] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab(initial.tab ?? "close");
    setRoomIds(initial.roomIds);
    setFrom(initial.date);
    setTo(initial.date);
    setWeekdays([]);
    setReason("");
    setMessage("");
    setValue("");
    setLabel("");
    setTimed(false);
    setStart("");
    setEnd("");
    setCloseHours(false);
    setCloseStart("");
    setCloseEnd("");
    const one = rooms.find((r) => r._id === initial.roomIds[0]);
    setSlotsText(one ? slotsToText(dayPlan(one.schedule, initial.date).slots) : "");
  }, [open, initial, rooms]);

  const dates = useMemo(() => (from && to && from <= to ? datesBetween(from, to, weekdays) : []), [from, to, weekdays]);
  const single = roomIds.length === 1 && dates.length === 1 ? rooms.find((r) => r._id === roomIds[0]) : null;
  const plan = single ? dayPlan(single.schedule, dates[0]) : null;
  const escapes = [...new Set(rooms.map((r) => r.escape))];

  async function send(body: Record<string, unknown>, ok: string) {
    if (!roomIds.length) return toast.error("Elige al menos una sala");
    if (!dates.length) return toast.error("Revisa las fechas");
    setBusy(true);
    try {
      const res = await fetch("/api/rooms/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomIds, dates, ...body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error);
      toast.success(ok, { description: `${roomIds.length} ${roomIds.length === 1 ? "sala" : "salas"} · ${dates.length} ${dates.length === 1 ? "día" : "días"}` });
      onDone();
    } catch (e) {
      toast.error("No se pudo guardar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  function applySpecial() {
    const slots = parseSlots(slotsText);
    if (!slots || !slots.length) return toast.error("Escribe las horas así: 10:00-11:00, 12:30-13:30");
    send({ action: "special", slots }, "Horario especial guardado");
  }
  function applyPrice() {
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n) || n === 0) return toast.error("Indica el ajuste, p. ej. 10 o -20");
    if (timed && !(start && end && start < end)) return toast.error("Revisa la franja horaria");
    send({ action: "price", adjustType, value: n, label, ...(timed ? { start, end } : {}) }, "Precio especial guardado");
  }

  function applyClose(reopen: boolean) {
    if (closeHours && !(closeStart && closeEnd && closeStart < closeEnd)) return toast.error("Indica el rango de horas (desde < hasta)");
    const hours = closeHours ? { start: closeStart, end: closeEnd } : {};
    if (reopen) return send({ action: "reopen", ...hours }, closeHours ? `Desbloqueadas de ${closeStart} a ${closeEnd}` : "Días reabiertos");
    send({ action: "close", reason, message, ...hours }, closeHours ? `Bloqueadas las reservas de ${closeStart} a ${closeEnd}` : "Días cerrados: no se podrá reservar");
  }

  const toggleRoom = (id: string) => setRoomIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestionar horario</DialogTitle>
          <DialogDescription>Cierra días, pon un horario o un precio especial en una o varias salas a la vez.</DialogDescription>
        </DialogHeader>

        {plan && single && (
          <div className="rounded-xl border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{single.name} · {new Date(`${dates[0]}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p>
            <p className="text-muted-foreground">
              {plan.blocks.length > 0 && plan.kind !== "closed" ? `Bloqueado ${plan.blocks.map((b) => `${b.start}–${b.end}`).join(", ")} · ` : ""}
              {plan.kind === "closed" ? `Cerrado${plan.reason ? ` (${plan.reason})` : ""}` : `${plan.kind === "special" ? "Horario especial" : "Horario habitual"}: ${slotsToText(plan.slots) || "sin horas"}`}
              {(single.schedule.priceRules ?? []).filter((r) => r.date === dates[0]).map((r) => ` · ${r.label || "Precio especial"} ${r.value > 0 ? "+" : ""}${r.value}${r.adjustType === "percent" ? "%" : "€"}${r.start ? ` (${r.start}–${r.end})` : ""}`).join("")}
            </p>
          </div>
        )}

        {/* Salas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Salas</p>
            <div className="flex gap-2 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={() => setRoomIds(rooms.map((r) => r._id))}>Todas</button>
              {escapes.length > 1 && escapes.map((e) => (
                <button key={e} type="button" className="text-primary hover:underline" onClick={() => setRoomIds(rooms.filter((r) => r.escape === e).map((r) => r._id))}>Solo {e}</button>
              ))}
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => setRoomIds([])}>Ninguna</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rooms.map((r) => (
              <button key={r._id} type="button" onClick={() => toggleRoom(r._id)} className={cn("rounded-lg border px-2.5 py-1 text-sm", roomIds.includes(r._id) ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:border-primary/40")}>
                {r.name}
              </button>
            ))}
          </div>
        </div>

        {/* Fechas */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="sa-from" className="text-sm font-medium">Desde</label>
            <Input id="sa-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <label htmlFor="sa-to" className="text-sm font-medium">Hasta</label>
            <Input id="sa-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Solo los días <span className="font-normal text-muted-foreground">(opcional)</span></p>
            <div className="flex gap-1">
              {WD.map((d) => (
                <button key={d.v} type="button" aria-pressed={weekdays.includes(d.v)} onClick={() => setWeekdays((w) => (w.includes(d.v) ? w.filter((x) => x !== d.v) : [...w, d.v]))} className={cn("size-8 rounded-md border text-xs font-semibold", weekdays.includes(d.v) ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40")}>
                  {d.l}
                </button>
              ))}
            </div>
          </div>
          <p className="pb-2 text-xs text-muted-foreground">{dates.length} {dates.length === 1 ? "día" : "días"}</p>
        </div>

        {/* Tipo de cambio */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm">
          {([["close", "Cerrar / abrir", Lock], ["special", "Horario especial", Sparkles], ["price", "Precio especial", Tag]] as const).map(([v, l, Icon]) => (
            <button key={v} type="button" onClick={() => setTab(v)} className={cn("flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 font-medium", tab === v ? "bg-card shadow-sm" : "text-muted-foreground")}>
              <Icon className="size-4" />{l}
            </button>
          ))}
        </div>

        {tab === "close" && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="sa-reason" className="text-sm font-medium">Motivo (interno)</label>
                <Input id="sa-reason" value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: Festivo, mantenimiento, evento privado" />
              </div>
              <div className="space-y-1">
                <label htmlFor="sa-msg" className="text-sm font-medium">Mensaje para el cliente</label>
                <Input id="sa-msg" value={message} maxLength={240} onChange={(e) => setMessage(e.target.value)} placeholder="Ej.: Cerrado por festivo" />
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
                <button type="button" onClick={() => setCloseHours(false)} className={cn("rounded-md px-3 py-1.5 font-medium", !closeHours ? "bg-card shadow-sm" : "text-muted-foreground")}>Todo el día</button>
                <button type="button" onClick={() => setCloseHours(true)} className={cn("rounded-md px-3 py-1.5 font-medium", closeHours ? "bg-card shadow-sm" : "text-muted-foreground")}>Rango de horas</button>
              </div>
              {closeHours && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span>De</span>
                  <Input type="time" aria-label="Bloquear desde la hora" value={closeStart} onChange={(e) => setCloseStart(e.target.value)} className="w-32" />
                  <span>a</span>
                  <Input type="time" aria-label="Bloquear hasta la hora" value={closeEnd} onChange={(e) => setCloseEnd(e.target.value)} className="w-32" />
                  <span className="text-xs text-muted-foreground">Se bloquea cualquier sesión que empiece o termine dentro de ese rango.</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Las reservas que ya existan no se cancelan: revísalas en el calendario.</p>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" disabled={busy} onClick={() => applyClose(true)}>{closeHours ? "Desbloquear ese rango" : "Reabrir esos días"}</Button>
              <Button variant="destructive" disabled={busy} onClick={() => applyClose(false)}>{busy && <Loader2 className="size-4 animate-spin" />}<Lock className="size-4" /> {closeHours ? "Bloquear horas" : "Cerrar reservas"}</Button>
            </DialogFooter>
          </div>
        )}

        {tab === "special" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="sa-slots" className="text-sm font-medium">Horas disponibles esos días</label>
              <Input id="sa-slots" value={slotsText} onChange={(e) => setSlotsText(e.target.value)} placeholder="10:00-11:00, 11:30-12:30, 17:00-18:00" />
              <p className="text-xs text-muted-foreground">Separadas por comas. Sustituyen al horario habitual solo en esas fechas (y reabren el día si estaba cerrado).</p>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" disabled={busy} onClick={() => send({ action: "normal" }, "Vuelve el horario habitual")}>Volver al horario habitual</Button>
              <Button disabled={busy} onClick={applySpecial}>{busy && <Loader2 className="size-4 animate-spin" />}<Sparkles className="size-4" /> Aplicar horario especial</Button>
            </DialogFooter>
          </div>
        )}

        {tab === "price" && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_120px]">
              <div className="space-y-1">
                <label htmlFor="sa-label" className="text-sm font-medium">Nombre</label>
                <Input id="sa-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Ej.: Festivo, Black Friday" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Tipo</p>
                <div className="flex rounded-md border p-0.5">
                  {(["amount", "percent"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setAdjustType(t)} className={cn("rounded px-3 py-1 text-sm", adjustType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{t === "amount" ? "€" : "%"}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor="sa-value" className="text-sm font-medium">Ajuste</label>
                <Input id="sa-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={adjustType === "amount" ? "+10 / -5" : "+20 / -15"} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> Solo en una franja horaria
            </label>
            {timed && (
              <div className="flex items-center gap-2">
                <Input type="time" aria-label="Desde la hora" value={start} onChange={(e) => setStart(e.target.value)} className="w-32" />
                <span className="text-muted-foreground">–</span>
                <Input type="time" aria-label="Hasta la hora" value={end} onChange={(e) => setEnd(e.target.value)} className="w-32" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">Se suma al precio por grupo de la tabla de la sala. Positivo = más caro, negativo = descuento.</p>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" disabled={busy} onClick={() => send({ action: "removePrice", ...(timed && start && end ? { start, end } : {}) }, "Precio especial quitado")}>Quitar precio especial</Button>
              <Button disabled={busy} onClick={applyPrice}>{busy && <Loader2 className="size-4 animate-spin" />}<Tag className="size-4" /> Aplicar precio</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
