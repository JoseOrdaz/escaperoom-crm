import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";

/* ───────────────────────────────
   Utilidades
──────────────────────────────── */
const HHMM = /^\d{2}:\d{2}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function safeObjectId(id?: string) {
  if (!id) return null;
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

const toDateAtLocal = (ymd: string, hhmm = "00:00") =>
  new Date(`${ymd}T${hhmm}:00`);

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

/* ───────────────────────────────
   GET → Obtener una reserva por ID
──────────────────────────────── */
export async function GET(req: NextRequest, context: any) {
  try {
    const { id } = await context.params; // 👈 se debe await
    const _id = safeObjectId(id);
    if (!_id) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const db = await connectDB();
    const doc = await db.collection("reservations").findOne({ _id });

    if (!doc) {
      return NextResponse.json({ ok: false, error: "Reserva no encontrada" }, { status: 404 });
    }

    // Obtener datos del cliente (si existe)
    let customer = null;
    if (doc.customerId) {
      const c = await db
        .collection("customers")
        .findOne(
          { _id: doc.customerId },
          { projection: { _id: 1, name: 1, email: 1, phone: 1 } }
        );

      if (c) {
        customer = {
          id: String(c._id),
          name: c.name ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
        };
      }
    }

    return NextResponse.json({
      _id: String(doc._id),
      roomId: String(doc.roomId),
      roomName: doc.roomName ?? "",
      start: doc.start?.toISOString?.() ?? "",
      end: doc.end?.toISOString?.() ?? "",
      players: doc.players ?? 0,
      price: doc.price ?? 0,
      language: doc.language ?? "es",
      notes: typeof doc.notes === "string" ? doc.notes : "",
      internalNotes:
        typeof doc.internalNotes === "string" ? doc.internalNotes : "",
      customer,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

/* ───────────────────────────────
   PATCH → Editar una reserva
──────────────────────────────── */
export async function PATCH(req: NextRequest, context: any) {
  try {
    const { id } = await context.params; // 👈 cambio aquí también
    const _id = safeObjectId(id);
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

    // Normalizar fechas y horas
    if (!YMD.test(body.date) || !HHMM.test(body.start)) {
      return NextResponse.json({ ok: false, error: "Fecha u hora inválida" }, { status: 400 });
    }

    const start = toDateAtLocal(body.date, body.start);
    const end = body.end
      ? toDateAtLocal(body.date, body.end)
      : addMinutes(start, room.durationMinutes ?? 60);

    // Calcular precio
    const priceRow = (room.priceTable ?? []).find(
      (r: { players: number; price: number }) =>
        Number(r.players) === Number(body.players)
    );
    const price = Number(priceRow?.price ?? 0);

    // Construir update limpio
    const update: any = {
      roomId,
      roomName: room.name,
      start,
      end,
      players: body.players,
      price,
      language: body.language ?? "es",
      notes: body.notes ?? "",
      internalNotes: body.internalNotes ?? "",
      updatedAt: new Date(),
      status: body.status ?? "pendiente",
    };

    // Cliente
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

      if (cDoc?._id) update.customerId = cDoc._id;
    } else if (body.customerId) {
      const cid = safeObjectId(body.customerId);
      if (cid) update.customerId = cid;
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

    return NextResponse.json({ ok: true, _id: id });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

/* ───────────────────────────────
   PUT → Alias de PATCH
──────────────────────────────── */
export async function PUT(req: NextRequest, context: any) {
  const { id } = await context.params; // 👈 también await
  return PATCH(req, { ...context, params: { id } });
}

/* ───────────────────────────────
   DELETE → Eliminar una reserva
──────────────────────────────── */
export async function DELETE(req: NextRequest, context: any) {
  try {
    const { id } = await context.params; // 👈 await añadido
    const _id = safeObjectId(id);
    if (!_id) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const db = await connectDB();
    const result = await db.collection("reservations").deleteOne({ _id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ ok: false, error: "Reserva no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: "Reserva eliminada correctamente",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Error al eliminar la reserva",
      },
      { status: 500 }
    );
  }
}
