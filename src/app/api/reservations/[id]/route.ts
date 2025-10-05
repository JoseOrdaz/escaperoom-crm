import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";

const HHMM = /^\d{2}:\d{2}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function safeObjectId(id?: string) {
  if (!id) return null;
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

const toDateAtLocal = (ymd: string, hhmm = "00:00") =>
  new Date(`${ymd}T${hhmm}:00`);
const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

/* PATCH editar reserva */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const _id = safeObjectId(params.id);
    if (!_id) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();
    const db = await connectDB();

    const roomId = safeObjectId(body.roomId);
    if (!roomId) {
      return NextResponse.json({ ok: false, error: "roomId inválido" }, { status: 400 });
    }

    const room = await db.collection("rooms").findOne({ _id: roomId });
    if (!room) {
      return NextResponse.json({ ok: false, error: "Sala no encontrada" }, { status: 404 });
    }

    // 🔹 Normalizar fechas y horas
    if (!YMD.test(body.date) || !HHMM.test(body.start)) {
      return NextResponse.json({ ok: false, error: "Fecha u hora inválida" }, { status: 400 });
    }
    const start = toDateAtLocal(body.date, body.start);
    const end = body.end
      ? toDateAtLocal(body.date, body.end)
      : addMinutes(start, room.durationMinutes ?? 60);

    // 🔹 Precio
    const priceRow = (room.priceTable ?? []).find(
      (r: any) => Number(r.players) === Number(body.players)
    );
    const price = Number(priceRow?.price ?? 0);

    // 🔹 Construir update limpio
    const update: any = {
      roomId,
      roomName: room.name,
      start,
      end,
      players: body.players,
      price,
      language: body.language ?? "es",
      description: body.description ?? "",
      notes: body.notes ?? "",
      updatedAt: new Date(),
    };

    // 🔹 Cliente
    if (body.customerEmail) {
      const email = String(body.customerEmail).toLowerCase().trim();
      const name = (body.customerName ?? email).toString().trim();
      const phone = (body.customerPhone ?? "").toString().trim();

      await db.collection("customers").updateOne(
        { email },
        { $set: { name, email, phone, updatedAt: new Date() } },
        { upsert: true }
      );

      const cDoc = await db
        .collection("customers")
        .findOne({ email }, { projection: { _id: 1 } });

      if (cDoc?._id) {
        update.customerId = cDoc._id;
      }
    } else if (body.customerId) {
      const cid = safeObjectId(body.customerId);
      if (cid) {
        update.customerId = cid;
      }
    }

    const res = await db.collection("reservations").updateOne(
      { _id },
      { $set: update }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json(
        { ok: false, error: "Reserva no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, _id: params.id });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Error" },
      { status: 500 }
    );
  }
}

/* PUT (alias de PATCH) */
export async function PUT(req: Request, ctx: { params: { id: string } }) {
  return PATCH(req, ctx);
}

/* DELETE eliminar reserva */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const _id = safeObjectId(params.id);
    if (!_id) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const db = await connectDB();
    const result = await db.collection("reservations").deleteOne({ _id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ ok: false, error: "Reserva no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "Reserva eliminada correctamente" });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Error al eliminar la reserva" },
      { status: 500 }
    );
  }
}
