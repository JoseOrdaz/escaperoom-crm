import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { sendReservationEmail } from "@/lib/reservation-emails";
import { currentProfile } from "@/lib/profile-session";
import { priceFor } from "@/lib/pricing";
import { canUseRoom, forbiddenRoom, requireAccess } from "@/lib/access";
import { findOrCreateCustomer } from "@/lib/customers";


/* ───────────────────────────────
   Utilidades
──────────────────────────────── */
const HHMM = /^\d{2}:\d{2}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function safeObjectId(id?: string) {
  if (!id) return null;
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

const toDateAtLocal = (ymd: string, hhmm = "00:00") => {
  const [year, month, day] = ymd.split("-").map(Number);
  const [hours, minutes] = hhmm.split(":").map(Number);

  // crea fecha directamente en UTC para evitar desplazamiento
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
};


const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

/* ───────────────────────────────
   GET → Obtener una reserva por ID
──────────────────────────────── */
export async function GET(req: NextRequest, context: any) {
  const auth = await requireAccess(null, "reservations.view");
  if (auth.response) return auth.response;
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
    if (!(await canUseRoom(db, auth.access, doc.roomId))) return forbiddenRoom();

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
  const auth = await requireAccess(req, "reservations.edit");
  if (auth.response) return auth.response;
  const access = auth.access;
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

    // La reserva y la sala nueva tienen que ser de mis escapes
    const current = await db
      .collection("reservations")
      .findOne({ _id }, { projection: { roomId: 1, price: 1, priceManual: 1, priceNote: 1 } });
    if (!current) return NextResponse.json({ ok: false, error: "Reserva no encontrada" }, { status: 404 });
    if (!(await canUseRoom(db, access, current.roomId)) || !(await canUseRoom(db, access, roomId))) return forbiddenRoom();

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
    // Calcular precio base según número de jugadores
const priceRow = (room.priceTable ?? []).find(
  (r: { players: number; price: number }) =>
    Number(r.players) === Number(body.players)
);
let price = priceFor(room as any, body.players, body.date, body.start).price;

  // 🧾 Cupón: si es el mismo que ya tenía la reserva se conserva tal cual
  // (sin volver a validar fechas ni sumar otro uso); si cambia, se valida el nuevo.
  const existing = await db
    .collection("reservations")
    .findOne({ _id }, { projection: { coupon: 1 } });
  const requestedCode = body.couponCode ? String(body.couponCode).toUpperCase().trim() : "";
  let appliedCoupon: any = null;
  let newCouponId: ObjectId | null = null;
  if (requestedCode && existing?.coupon?.code?.toUpperCase() === requestedCode) {
    appliedCoupon = existing.coupon;
  } else if (requestedCode) {
    const coupon = await db.collection("coupons").findOne({
      code: requestedCode,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
      $or: [{ roomId: null }, { roomId }],
    });
    if (!coupon) {
      return NextResponse.json(
        { ok: false, error: "El cupón no es válido para esta sala o ha caducado" },
        { status: 400 }
      );
    }
    appliedCoupon = { code: coupon.code, type: coupon.type, value: coupon.value };
    newCouponId = coupon._id;
  }
  if (appliedCoupon) {
    price =
      appliedCoupon.type === "percent"
        ? Math.max(0, price - (price * appliedCoupon.value) / 100)
        : Math.max(0, price - appliedCoupon.value);
  }
    // 💶 Precio pagado ajustado a mano (p. ej. descuento aplicado después del juego)
    // Solo quien tiene permiso puede cambiarlo; si no, se respeta el ajuste que ya hubiera
    const manualPrice = access.can("reservations.price")
      ? body.manualPrice !== null && body.manualPrice !== undefined && body.manualPrice !== "" && Number.isFinite(Number(body.manualPrice))
        ? Math.max(0, Number(body.manualPrice))
        : null
      : current.priceManual
        ? Number(current.price ?? 0)
        : null;
    if (!access.can("reservations.price") && current.priceManual) body.priceNote = current.priceNote ?? "";
    if (manualPrice !== null) price = manualPrice;

    // Construir update limpio
    const update: any = {
      roomId,
      roomName: room.name,
      start,
      end,
      players: body.players,
      price,
      priceManual: manualPrice !== null,
      priceNote: manualPrice !== null ? String(body.priceNote ?? "").slice(0, 300) : "",
      language: body.language ?? "es",
      notes: body.notes ?? "",
      internalNotes: body.internalNotes ?? "",
      updatedAt: new Date(),
      status: body.status ?? "pendiente",
      ...rankingUpdate(body.ranking),
        ...(appliedCoupon ? { coupon: appliedCoupon } : { coupon: null }), // 👈 nuevo campo

    };

    // Cliente
    if (body.customerEmail) {
      // Ya no sobrescribimos el cliente que comparta email: buscamos el que
      // coincida también en teléfono/nombre o creamos uno nuevo.
      update.customerId = await findOrCreateCustomer(db, {
        name: body.customerName,
        email: String(body.customerEmail),
        phone: body.customerPhone,
      });
    } else if (body.customerId) {
      const cid = safeObjectId(body.customerId);
      if (cid) update.customerId = cid;
    }

    // ✅ Verificar conflictos solo si se va a activar la reserva
if (body.status !== "cancelada") {
  // Buscar salas vinculadas
  const linkedRoomIds = (room.linkedRooms ?? [])
    .map((id: string) => safeObjectId(id))
    .filter(Boolean);

  // Comprobar si hay otra reserva activa que se solape
  const conflict = await db.collection("reservations").findOne({
    _id: { $ne: _id }, // excluir la misma
    roomId: { $in: [roomId, ...linkedRoomIds] },
    start: { $lt: end },
    end: { $gt: start },
    status: { $ne: "cancelada" }, // solo activas
  });

  if (conflict) {
    return NextResponse.json(
      {
        ok: false,
        error: `Ya hay una reserva activa (${conflict.status}) en esa franja`,
      },
      { status: 409 }
    );
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
    if (newCouponId) {
      await db.collection("coupons").updateOne({ _id: newCouponId }, { $inc: { usedCount: 1 } });
    }

    /* ─────────────── Aviso opcional al cliente (desde el modal) ─────────────── */
    let email: { ok: boolean; error?: string } | undefined;
    if (body.sendEmail && access.can("reservations.notify")) {
      const profile = await currentProfile().catch(() => null);
      email = await sendReservationEmail(db, {
        reservationId: _id,
        kind: "status",
        trigger: "manual",
        event: body.status === "cancelada" ? "cancelled" : "updated",
        message: typeof body.emailMessage === "string" ? body.emailMessage.slice(0, 2000) : undefined,
        sentBy: profile ? { id: String(profile._id), name: `${profile.name ?? ""} ${profile.surname ?? ""}`.trim() } : null,
      });
    }

    return NextResponse.json({ ok: true, _id: id, email });
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
  const auth = await requireAccess(req, "reservations.delete");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params; // 👈 await añadido
    const _id = safeObjectId(id);
    if (!_id) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const db = await connectDB();
    const target = await db.collection("reservations").findOne({ _id }, { projection: { roomId: 1 } });
    if (!target) return NextResponse.json({ ok: false, error: "Reserva no encontrada" }, { status: 404 });
    if (!(await canUseRoom(db, auth.access, target.roomId))) return forbiddenRoom();
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

/** Ranking del equipo: `undefined` → no se toca; `null` → se quita */
function rankingUpdate(input: unknown) {
  if (input === undefined) return {};
  if (!input || typeof input !== "object") return { ranking: null };
  const r = input as Record<string, unknown>;
  const teamName = String(r.teamName ?? "").trim().slice(0, 80);
  const num = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const score = num(r.score);
  const timeSeconds = num(r.timeSeconds);
  if (!teamName && score === null && timeSeconds === null) return { ranking: null };
  return {
    ranking: {
      teamName,
      score: score === null ? null : Math.max(0, Math.round(score)),
      timeSeconds: timeSeconds === null ? null : Math.max(0, Math.round(timeSeconds)),
      updatedAt: new Date(),
    },
  };
}
