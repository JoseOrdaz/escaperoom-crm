import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { z } from "zod";

/* ───────── helpers ───────── */
const HHMM = /^\d{2}:\d{2}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const toDateAtLocal = (ymd: string, hhmm = "00:00") =>
  new Date(`${ymd}T${hhmm}:00`);
const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

function safeObjectId(id?: string) {
  if (!id) return null;
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

const postSchema = z.object({
  roomId: z.string().min(1),
  date: z.string().regex(YMD, "Fecha inválida"),
  start: z.string().regex(HHMM, "Hora inicio inválida"),
  end: z.string().regex(HHMM).optional(),
  players: z.coerce.number().int().min(1),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  language: z.enum(["es", "en", "ru"]).default("es"),
  // description: z.string().max(140).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  internalNotes: z.string().max(1000).optional().default(""),
  status: z.enum(["pendiente", "confirmada", "cancelada"]).default("pendiente"),

});

/* ───────── GET ───────── */
export async function GET(req: Request) {
  
  try {
    const { searchParams } = new URL(req.url);
    
    // ✅ estadísticas globales
      if (searchParams.get("stats") === "1") {
        const db = await connectDB();

        // total histórico
        const totalReservations = await db.collection("reservations").countDocuments();

        // rango mes actual
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const reservationsThisMonth = await db.collection("reservations").countDocuments({
          start: { $gte: start, $lt: end },
        });

        return NextResponse.json({
          totalReservations,
          reservationsThisMonth,
        });
      }

    const customerId = searchParams.get("customerId");
    if (customerId) {
      // 🔎 buscar reservas por cliente
      const db = await connectDB();
      const docs = await db
        .collection("reservations")
        .find({ customerId: safeObjectId(customerId) })
        .sort({ start: -1 })
        .toArray();

      return NextResponse.json(
        docs.map((d: any) => ({
          _id: String(d._id),
          roomId: String(d.roomId),
          roomName: d.roomName ?? "Sala",
          start: d.start.toISOString(),
          end: d.end.toISOString(),
          players: d.players,
          price: d.price ?? 0,
          language: d.language ?? "es",
          // description: d.description ?? "",
          notes: d.notes ?? "",
          internalNotes: d.internalNotes ?? "",
        }))
      );
    }

    // 🔥 modo original con rango from/to
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";

    if (!YMD.test(from) || !YMD.test(to)) {
      return NextResponse.json(
        { ok: false, error: "Parámetros from/to inválidos" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const fromD = toDateAtLocal(from, "00:00");
    const toD = toDateAtLocal(to, "00:00");

    const roomId = safeObjectId(searchParams.get("roomId") ?? "");
    const query: any = { start: { $gte: fromD }, end: { $lt: toD } };

    if (roomId) {
      // obtener sala y vinculadas
      const room = await db.collection("rooms").findOne({ _id: roomId });
      const linked = (room?.linkedRooms ?? []).map((id: string) => safeObjectId(id)).filter(Boolean);
      query.roomId = { $in: [roomId, ...linked] };
    }

    const docs = await db
      .collection("reservations")
      .find(query)
      .sort({ start: 1 })
      .toArray();

      

    // 🔎 recolectar roomIds y customerIds
    const roomIds = [...new Set(docs.map((d: any) => String(d.roomId)))];
    const custIds = [...new Set(docs.map((d: any) => String(d.customerId)).filter(Boolean))];

    const rooms = await db.collection("rooms")
      .find(
        { _id: { $in: roomIds.map(safeObjectId).filter((id): id is ObjectId => id !== null) } },
        { projection: { _id: 1, name: 1 } }
      )
      .toArray();

    const customers = custIds.length
      ? await db.collection("customers")
          .find(
            { _id: { $in: custIds.map(safeObjectId).filter(Boolean) } },
            { projection: { _id: 1, name: 1, email: 1, phone: 1 } }
          )
          .toArray()
      : [];

    const roomMap = new Map(rooms.map((r) => [String(r._id), r.name]));
    const customerMap = new Map(customers.map((c) => [String(c._id), c]));

    // 🔥 construir salida con cliente incluido
    const out = docs.map((d: any) => {
      const custId = d.customerId ? String(d.customerId) : null;
      const cust = custId ? customerMap.get(custId) : null;

      return {
        _id: String(d._id),
        roomId: String(d.roomId),
        roomName: d.roomName ?? roomMap.get(String(d.roomId)) ?? "Sala",
        start: d.start.toISOString(),
        end: d.end.toISOString(),
        players: d.players,
        price: d.price ?? 0,
        language: d.language ?? "es",
        // description: d.description ?? "",
        notes: d.notes ?? "",
        internalNotes: d.internalNotes ?? "",
        status: d.status ?? "pendiente",
        customer: cust
          ? {
              id: String(cust._id),
              name: cust.name ?? "",
              email: cust.email ?? "",
              phone: cust.phone ?? "",
            }
          : null,
      };
    });

    // dentro de GET, después de const docs = await db.collection("reservations")...
console.log("🛑 Reservas encontradas:", docs.map((d: any) => ({
  id: String(d._id),
  roomName: d.roomName,
  startISO: d.start,
  endISO: d.end,
  hhmmStart: d.start instanceof Date
    ? d.start.toISOString().substring(11, 16)
    : new Date(d.start).toISOString().substring(11, 16),
  hhmmEnd: d.end instanceof Date
    ? d.end.toISOString().substring(11, 16)
    : new Date(d.end).toISOString().substring(11, 16),
  players: d.players,
})));

const occupied = docs.map((d: any) => {
  const start = d.start instanceof Date
    ? d.start.toISOString().substring(11, 16)
    : new Date(d.start).toISOString().substring(11, 16);

  const end = d.end instanceof Date
    ? d.end.toISOString().substring(11, 16)
    : new Date(d.end).toISOString().substring(11, 16);

  return `${start}-${end}`;
});

console.log("⛔ Franjas ocupadas:", [...new Set(occupied)]);


    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Error" }, { status: 500 });
  }
}

/* ───────── POST ───────── */
// ⬇️ sin cambios, lo dejo igual
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const v = parsed.data;
    const db = await connectDB();

    const roomId = safeObjectId(v.roomId);
    if (!roomId)
      return NextResponse.json({ ok: false, error: "roomId inválido" }, { status: 400 });

    const room = await db.collection("rooms").findOne({ _id: roomId });
    if (!room)
      return NextResponse.json({ ok: false, error: "Sala no encontrada" }, { status: 404 });

    const start = toDateAtLocal(v.date, v.start);
    const end = v.end ? toDateAtLocal(v.date, v.end) : addMinutes(start, room.durationMinutes ?? 60);

    const linkedRoomIds = (room.linkedRooms ?? []).map((id: string) => safeObjectId(id)).filter(Boolean);

    // 🔒 comprobar conflictos en la sala y las vinculadas
    const conflict = await db.collection("reservations").findOne({
      roomId: { $in: [roomId, ...linkedRoomIds] },
      start: { $lt: end },
      end: { $gt: start },
    });
    if (conflict)
      return NextResponse.json(
        { ok: false, error: "Ya hay una reserva en esa franja" },
        { status: 409 }
      );

    const priceRow = (room.priceTable ?? []).find(
      (r: any) => Number(r.players) === Number(v.players)
    );
    const price = Number(priceRow?.price ?? 0);

    // ---- Cliente ----
    let customerId: ObjectId | null = null;
    if (v.customerId) {
      customerId = safeObjectId(v.customerId);
    } else if (v.customerEmail) {
      const email = v.customerEmail.toLowerCase().trim();
      const existing = await db.collection("customers").findOne({ email });
      if (existing) {
        customerId = existing._id;
      } else {
        const resC = await db.collection("customers").insertOne({
          name: v.customerName ?? email,
          email,
          phone: v.customerPhone ?? "",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        customerId = resC.insertedId;
      }
    }

    const doc = {
      roomId,
      roomName: room.name,
      start,
      end,
      players: v.players,
      price,
      language: v.language,
      // description: v.description,
      notes: v.notes,
      internalNotes: v.internalNotes ?? "",
      ...(customerId ? { customerId } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: v.status,
    };

    const res = await db.collection("reservations").insertOne(doc);
    return NextResponse.json({ ok: true, _id: String(res.insertedId) }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Error" },
      { status: 500 }
    );
  }
}
