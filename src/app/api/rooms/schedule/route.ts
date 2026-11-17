import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireAccess, scopedRooms } from "@/lib/access";
import { normPriceRules, type PriceRule } from "@/lib/pricing";
import { normBlocks, type DayOff, type Override } from "@/lib/room-schedule";

/**
 * PATCH /api/rooms/schedule — cambios de horario en varias salas a la vez.
 * Solo toca daysOff / overrides / priceRules de las salas indicadas (de mis escapes).
 */
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const slot = z.object({ start: hhmm, end: hhmm }).refine((s) => s.start < s.end, "La hora de inicio debe ser anterior al fin");

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close"), roomIds: z.array(z.string()).min(1), dates: z.array(ymd).min(1).max(400), reason: z.string().max(120).default(""), message: z.string().max(240).default(""), start: hhmm.optional(), end: hhmm.optional() }),
  z.object({ action: z.literal("reopen"), roomIds: z.array(z.string()).min(1), dates: z.array(ymd).min(1).max(400), start: hhmm.optional(), end: hhmm.optional() }),
  z.object({ action: z.literal("special"), roomIds: z.array(z.string()).min(1), dates: z.array(ymd).min(1).max(400), slots: z.array(slot).min(1).max(30) }),
  z.object({ action: z.literal("normal"), roomIds: z.array(z.string()).min(1), dates: z.array(ymd).min(1).max(400) }),
  z.object({
    action: z.literal("price"), roomIds: z.array(z.string()).min(1), dates: z.array(ymd).min(1).max(400),
    start: hhmm.optional(), end: hhmm.optional(), adjustType: z.enum(["percent", "amount"]), value: z.number().refine((v) => v !== 0, "El ajuste no puede ser 0"),
    label: z.string().max(80).default(""),
  }),
  z.object({ action: z.literal("removePrice"), roomIds: z.array(z.string()).min(1), dates: z.array(ymd).min(1).max(400), start: hhmm.optional(), end: hhmm.optional() }),
]);

export async function PATCH(req: Request) {
  const auth = await requireAccess(req, "rooms.manage");
  if (auth.response) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const v = parsed.data;

  const db = await connectDB();
  const mine = new Set((await scopedRooms(db, auth.access)).map((r) => String(r._id)));
  const ids = [...new Set(v.roomIds)].filter((id) => mine.has(id));
  if (ids.length !== new Set(v.roomIds).size) return NextResponse.json({ ok: false, error: "Alguna sala no pertenece a tus escapes" }, { status: 403 });

  const dates = new Set(v.dates);
  const rooms = await db.collection("rooms").find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { schedule: 1, scheduleBlocks: 1 } }).toArray();
  const hours = (v.action === "close" || v.action === "reopen") && v.start && v.end ? { start: v.start, end: v.end } : null;
  if ((v.action === "close" || v.action === "reopen") && (v.start || v.end) && !(hours && hours.start < hours.end)) {
    return NextResponse.json({ ok: false, error: "Revisa el rango de horas" }, { status: 400 });
  }

  for (const room of rooms) {
    const s = room.schedule ?? {};
    let daysOff: DayOff[] = Array.isArray(s.daysOff) ? s.daysOff : [];
    let overrides: Override[] = Array.isArray(s.overrides) ? s.overrides : [];
    let priceRules: PriceRule[] = normPriceRules(s.priceRules);
    let blocks = normBlocks(room.scheduleBlocks);

    switch (v.action) {
      case "close":
        if (hours) {
          blocks = [
            ...blocks.filter((b) => !(dates.has(b.date) && b.start === hours.start && b.end === hours.end)),
            ...[...dates].map((date) => ({ date, ...hours, reason: v.reason })),
          ];
          break;
        }
        daysOff = [...daysOff.filter((d) => !dates.has(d.date)), ...[...dates].map((date) => ({ date, reason: v.reason, message: v.message }))];
        break;
      case "reopen":
        if (hours) {
          blocks = blocks.filter((b) => !(dates.has(b.date) && b.start === hours.start && b.end === hours.end));
          break;
        }
        daysOff = daysOff.filter((d) => !dates.has(d.date));
        blocks = blocks.filter((b) => !dates.has(b.date));
        break;
      case "special":
        // Un horario especial reabre el día si estaba cerrado
        daysOff = daysOff.filter((d) => !dates.has(d.date));
        overrides = [...overrides.filter((o) => !dates.has(o.date)), ...[...dates].map((date) => ({ date, slots: v.slots }))];
        break;
      case "normal":
        overrides = overrides.filter((o) => !dates.has(o.date));
        break;
      case "price": {
        const timed = v.start && v.end && v.start < v.end;
        const same = (r: PriceRule) => dates.has(r.date) && (timed ? r.start === v.start && r.end === v.end : !r.start && !r.end);
        priceRules = [
          ...priceRules.filter((r) => !same(r)),
          ...[...dates].map((date) => ({ date, ...(timed ? { start: v.start, end: v.end } : {}), adjustType: v.adjustType, value: v.value, label: v.label })),
        ];
        break;
      }
      case "removePrice":
        priceRules = priceRules.filter((r) => !(dates.has(r.date) && (v.start ? r.start === v.start && r.end === v.end : true)));
        break;
    }

    daysOff.sort((a, b) => a.date.localeCompare(b.date));
    overrides.sort((a, b) => a.date.localeCompare(b.date));
    blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    priceRules.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""));
    await db.collection("rooms").updateOne(
      { _id: room._id },
      { $set: { "schedule.daysOff": daysOff, "schedule.overrides": overrides, "schedule.priceRules": priceRules, scheduleBlocks: blocks, updatedAt: new Date() } }
    );
  }
  return NextResponse.json({ ok: true, rooms: rooms.length, dates: dates.size });
}
