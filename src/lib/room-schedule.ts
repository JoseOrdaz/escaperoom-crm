/**
 * Horario de las salas (cliente y servidor, sin dependencias).
 *   schedule.template   → horario semanal habitual
 *   schedule.daysOff    → días cerrados (no se puede reservar)
 *   schedule.overrides  → horario especial para un día concreto
 *   schedule.priceRules → precio especial (ver pricing.ts)
 */
import type { PriceRule } from "@/lib/pricing";

export type TimeSlot = { start: string; end: string };
export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type DayOff = { date: string; reason?: string; message?: string };
export type Override = { date: string; slots: TimeSlot[] };
/** Franja bloqueada (no se puede reservar) dentro de un día */
export type TimeBlock = { date: string; start: string; end: string; reason?: string };
export type RoomSchedule = {
  template: Partial<Record<Weekday, TimeSlot[]>>;
  daysOff?: DayOff[];
  overrides?: Override[];
  priceRules?: PriceRule[];
  blocks?: TimeBlock[];
};

export const WEEKDAYS: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Día de la semana de una fecha YYYY-MM-DD (sin zonas horarias) */
export const weekdayOf = (ymd: string): Weekday => WEEKDAYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()];

export function dayPlan(schedule: RoomSchedule | null | undefined, ymd: string) {
  const blocks = (schedule?.blocks ?? []).filter((b) => b.date === ymd);
  const off = schedule?.daysOff?.find((d) => d.date === ymd);
  if (off) return { kind: "closed" as const, slots: [] as TimeSlot[], reason: off.reason ?? "", blocks };
  const ov = schedule?.overrides?.find((o) => o.date === ymd);
  if (ov) return { kind: "special" as const, slots: ov.slots, reason: "", blocks };
  return { kind: "normal" as const, slots: schedule?.template?.[weekdayOf(ymd)] ?? [], reason: "", blocks };
}

/** ¿La sesión cae (aunque sea en parte) dentro de una franja bloqueada? */
export const blockFor = (blocks: TimeBlock[] | undefined, ymd: string, slot: TimeSlot) =>
  (blocks ?? []).find((b) => b.date === ymd && b.start < slot.end && b.end > slot.start) ?? null;

/** Horas reservables de ese día (sin días cerrados ni franjas bloqueadas) */
export function openSlots(schedule: RoomSchedule | null | undefined, ymd: string) {
  const plan = dayPlan(schedule, ymd);
  return plan.slots.filter((s) => !blockFor(plan.blocks, ymd, s));
}

export function normBlocks(input: unknown): TimeBlock[] {
  const hm = /^\d{2}:\d{2}$/;
  return (Array.isArray(input) ? input : [])
    .map((b: Record<string, unknown>) => ({ date: String(b?.date ?? ""), start: String(b?.start ?? ""), end: String(b?.end ?? ""), reason: String(b?.reason ?? "").slice(0, 120) }))
    .filter((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.date) && hm.test(b.start) && hm.test(b.end) && b.start < b.end);
}

/** Fechas YYYY-MM-DD de un rango (incluido), opcionalmente solo ciertos días de la semana */
export function datesBetween(from: string, to: string, weekdays?: Weekday[]) {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end && out.length < 400) {
    const ymd = d.toISOString().slice(0, 10);
    if (!weekdays?.length || weekdays.includes(weekdayOf(ymd))) out.push(ymd);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** "10:00-11:00, 12:00-13:00" → slots válidos */
export function parseSlots(text: string): TimeSlot[] | null {
  const parts = text.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
  const slots: TimeSlot[] = [];
  for (const p of parts) {
    const m = /^(\d{1,2}):(\d{2})\s*[-–a]\s*(\d{1,2}):(\d{2})$/.exec(p);
    if (!m) return null;
    const s = `${m[1].padStart(2, "0")}:${m[2]}`;
    const e = `${m[3].padStart(2, "0")}:${m[4]}`;
    if (s >= e) return null;
    slots.push({ start: s, end: e });
  }
  return slots.sort((a, b) => a.start.localeCompare(b.start));
}
export const slotsToText = (slots: TimeSlot[]) => slots.map((s) => `${s.start}-${s.end}`).join(", ");
