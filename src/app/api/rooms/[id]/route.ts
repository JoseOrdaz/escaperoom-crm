import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { z } from "zod";

/* ─── Schemas ─────────────────────────────────────────────── */
const timeHHmm = z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:mm");
const timeSlot = z.object({ start: timeHHmm, end: timeHHmm })
  .refine((s) => s.start < s.end, { path: ["end"], message: "Inicio < fin" });

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
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  reason: z.string().max(120).optional().or(z.literal("")),
});

const override = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  slots: z.array(timeSlot).min(1),
});

// Acepta url absoluta o ruta relativa que empiece por “/”
const imageUrlSchema = z
  .string()
  .optional()
  .transform((v) => (typeof v === "string" ? v.trim() : ""))
  .refine((v) => v === "" || /^https?:\/\//i.test(v) || v.startsWith("/"), {
    message: "URL inválida (usa http(s)://… o una ruta que empiece por /)",
  });

const priceRow = z.object({
  players: z.coerce.number().int().min(1),
  price: z.coerce.number().min(0),
});

const bodySchema = z.object({
  name: z.string().min(1).max(60).optional(),
  active: z.coerce.boolean().optional(),
  durationMinutes: z.coerce.number().int().min(30).max(180).optional(),
  capacityMin: z.coerce.number().int().min(1).optional(),
  capacityMax: z.coerce.number().int().min(1).optional(),
  imageUrl: imageUrlSchema.optional(),
  priceTable: z.array(priceRow).optional(),
  schedule: z.object({
    template: weekTemplate,
    daysOff: z.array(dayOff).default([]),
    overrides: z.array(override).default([]),
  }).optional(),
  linkedRooms: z.array(z.string()).optional(),
})
  .refine((v) => {
    if (v.capacityMin == null || v.capacityMax == null) return true;
    return v.capacityMin <= v.capacityMax;
  }, { path: ["capacityMin"], message: "El mínimo no puede ser mayor que el máximo" })
  .strip();

/* ─── Helper de ObjectId ──────────────────────────────────── */
function asObjectId(id: string) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

/* ─── Normalizadores ──────────────────────────────────────── */
const hhmm = /^\d{2}:\d{2}$/;
function normSlots(a: any): { start: string; end: string }[] {
  if (!Array.isArray(a)) return [];
  return a
    .map((s) => ({ start: s?.start, end: s?.end }))
    .filter((s) => typeof s.start === "string" && typeof s.end === "string")
    .filter((s) => hhmm.test(s.start) && hhmm.test(s.end) && s.start < s.end);
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
      .map((o: any) => ({
        date: o?.date,
        slots: normSlots(o?.slots),
      }))
      .filter((o: any) => typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && o.slots.length > 0),
  };
}

function normPriceTable(pt: any): { players: number; price: number }[] {
  if (!Array.isArray(pt)) return [];
  const map = new Map<number, number>();
  for (const r of pt) {
    const players = Number(r?.players);
    const price = Number(r?.price);
    if (Number.isInteger(players) && players >= 1 && Number.isFinite(price) && price >= 0) {
      // si llega duplicado el mismo nº de jugadores, nos quedamos con el último
      map.set(players, price);
    }
  }
  return [...map.entries()]
    .map(([players, price]) => ({ players, price }))
    .sort((a, b) => a.players - b.players);
}

/* ─── Handler PATCH ───────────────────────────────────────── */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const _id = asObjectId(params.id);
    if (!_id) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Construimos $set solo con campos presentes
    const $set: Record<string, any> = { updatedAt: new Date() };

    if (data.name !== undefined) $set.name = data.name.trim();
    if (data.active !== undefined) $set.active = !!data.active;
    if (data.durationMinutes !== undefined) $set.durationMinutes = data.durationMinutes;
    if (data.capacityMin !== undefined) $set.capacityMin = data.capacityMin;
    if (data.capacityMax !== undefined) $set.capacityMax = data.capacityMax;
    if (data.imageUrl !== undefined) $set.imageUrl = data.imageUrl ?? "";

    if (data.linkedRooms !== undefined) {
      $set.linkedRooms = Array.isArray(data.linkedRooms)
        ? data.linkedRooms.filter((id) => /^[a-f0-9]{24}$/i.test(id))
        : [];
    }

    if (data.priceTable !== undefined) {
      $set.priceTable = normPriceTable(data.priceTable);
    }

    if (data.schedule !== undefined) {
      $set.schedule = normSchedule(data.schedule);
    }

    const db = await connectDB();
    const res = await db.collection("rooms").updateOne({ _id }, { $set });

    if (res.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: "Sala no encontrada" }, { status: 404 });
    }

    const doc = await db
      .collection("rooms")
      .findOne({ _id }, { projection: { _id: 1, imageUrl: 1 } });

    return NextResponse.json({
      ok: true,
      _id: doc?._id.toString(),
      imageUrl: doc?.imageUrl ?? "",
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Error interno" },
      { status: 500 }
    );
  }
}


export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const db = await connectDB();
  const _id = new ObjectId(params.id);

  // (Opcional) Comprueba reservas vinculadas antes de borrar
  // const reservations = await db.collection("reservations").countDocuments({ roomId: _id });
  // if (reservations > 0) {
  //   return new NextResponse("La sala tiene reservas vinculadas", { status: 400 });
  // }

  await db.collection("rooms").deleteOne({ _id });
  return NextResponse.json({ ok: true });
}