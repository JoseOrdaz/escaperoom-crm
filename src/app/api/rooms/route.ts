// src/app/api/rooms/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { z } from "zod";

/* ── Schemas y normalizadores (resumen) ───────────────────── */
const timeHHmm = z.string().regex(/^\d{2}:\d{2}$/);
const timeSlot = z.object({ start: timeHHmm, end: timeHHmm }).refine(s => s.start < s.end, { path: ["end"], message: "Inicio < fin" });

const weekTemplate = z.object({
  monday: z.array(timeSlot).default([]),
  tuesday: z.array(timeSlot).default([]),
  wednesday: z.array(timeSlot).default([]),
  thursday: z.array(timeSlot).default([]),
  friday: z.array(timeSlot).default([]),
  saturday: z.array(timeSlot).default([]),
  sunday: z.array(timeSlot).default([]),
});

const dayOff = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(120).optional().or(z.literal("")),
});

const override = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slots: z.array(timeSlot).min(1),
});

const priceRow = z.object({
  players: z.coerce.number().int().min(1),
  price: z.coerce.number().min(0),
});

// Permite URL absoluta o ruta relativa que empiece por “/”
const imageUrlSchema = z.string().optional().transform(v => (typeof v === "string" ? v.trim() : ""))
  .refine(v => v === "" || /^https?:\/\//i.test(v!) || v!.startsWith("/"), {
    message: "URL inválida (usa http(s)://… o una ruta /uploads/..)",
  });

const bodySchema = z.object({
  name: z.string().min(1).max(60),
  active: z.coerce.boolean().default(true),
  durationMinutes: z.coerce.number().int().min(30).max(180),
  capacityMin: z.coerce.number().int().min(1),
  capacityMax: z.coerce.number().int().min(1),
  imageUrl: imageUrlSchema.optional(),
  priceTable: z.array(priceRow).min(1),
  schedule: z.object({
    template: weekTemplate,
    daysOff: z.array(dayOff).default([]),
    overrides: z.array(override).default([]),
  }).default({
    template: { monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[], sunday:[] },
    daysOff: [],
    overrides: [],
  }),
}).refine(v => v.capacityMin <= v.capacityMax, { path: ["capacityMin"], message: "El mínimo no puede ser mayor que el máximo" });

const HHMM = /^\d{2}:\d{2}$/;
function normSlots(a: any) {
  if (!Array.isArray(a)) return [];
  return a
    .map(s => ({ start: s?.start, end: s?.end }))
    .filter(s => typeof s.start === "string" && typeof s.end === "string")
    .filter(s => HHMM.test(s.start) && HHMM.test(s.end) && s.start < s.end);
}
function normSchedule(s: any) {
  const t = s?.template ?? {};
  const daysOff = Array.isArray(s?.daysOff) ? s.daysOff : [];
  const overrides = Array.isArray(s?.overrides) ? s.overrides : [];
  return {
    template: {
      monday: normSlots(t.monday),
      tuesday: normSlots(t.tuesday),
      wednesday: normSlots(t.wednesday),
      thursday: normSlots(t.thursday),
      friday: normSlots(t.friday),
      saturday: normSlots(t.saturday),
      sunday: normSlots(t.sunday),
    },
    daysOff: daysOff
      .map((d: any) => ({ date: d?.date, reason: d?.reason ?? "" }))
      .filter((d: any) => typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date)),
    overrides: overrides
      .map((o: any) => ({ date: o?.date, slots: normSlots(o?.slots) }))
      .filter((o: any) => typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && o.slots.length > 0),
  };
}
function normPriceTable(pt: any) {
  if (!Array.isArray(pt)) return [];
  const map = new Map<number, number>();
  for (const r of pt) {
    const players = Number(r?.players);
    const price = Number(r?.price);
    if (Number.isInteger(players) && players >= 1 && Number.isFinite(price) && price >= 0) {
      map.set(players, price);
    }
  }
  return [...map.entries()].map(([players, price]) => ({ players, price })).sort((a, b) => a.players - b.players);
}

/* ── POST /api/rooms ───────────────────────────────────────── */
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const v = parsed.data;
    const db = await connectDB();

    const doc = {
      name: v.name.trim(),
      active: !!v.active,
      durationMinutes: v.durationMinutes,
      capacityMin: v.capacityMin,
      capacityMax: v.capacityMax,
      imageUrl: v.imageUrl ?? "",
      priceTable: normPriceTable(v.priceTable),
      schedule: normSchedule(v.schedule),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await db.collection("rooms").insertOne(doc as any);

    return NextResponse.json({ ok: true, _id: res.insertedId.toString() }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 });
  }
}



/* ── GET /api/rooms ───────────────────────────────────────────
   Devuelve salas activas con los campos necesarios
   para el calendario (precio y horario normalizados).
----------------------------------------------------------------*/
export async function GET() {
  try {
    const db = await connectDB();
    const docs = await db.collection("rooms")
      .find({ active: { $ne: false } }, {
        projection: {
          name: 1,
          active: 1,
          durationMinutes: 1,
          capacityMin: 1,
          capacityMax: 1,
          imageUrl: 1,
          priceTable: 1,
          schedule: 1,
        }
      })
      .sort({ name: 1 })
      .toArray();

    const result = docs.map((d: any) => ({
      _id: d._id.toString(),
      name: d.name,
      imageUrl: typeof d.imageUrl === "string" ? d.imageUrl : "",
      durationMinutes: Number(d.durationMinutes) || 60,
      capacityMin: Number(d.capacityMin) || 1,
      capacityMax: Number(d.capacityMax) || 1,
      priceTable: normPriceTable(d.priceTable),
      schedule: normSchedule(d.schedule),
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
