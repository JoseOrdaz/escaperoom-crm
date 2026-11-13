import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { createMailer } from "@/lib/mailer";
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
    // Calcular precio base según número de jugadores
const priceRow = (room.priceTable ?? []).find(
  (r: { players: number; price: number }) =>
    Number(r.players) === Number(body.players)
);
let price = Number(priceRow?.price ?? 0);

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

    /* ─────────────── Envío opcional de correo ─────────────── */
if (body.sendEmail && (body.status === "pendiente" || body.status === "cancelada")) {
  try {
    const reservation = await db.collection("reservations").findOne({ _id });
    const customerId = safeObjectId(reservation?.customerId);
    const customer = customerId
      ? await db.collection("customers").findOne({ _id: customerId })
      : null;
    if (!customer?.email) throw new Error("Cliente sin email");

    const transporter = createMailer();

    function normalizeText(text: string) {
      return text
        .toLowerCase()
        .normalize("NFD") // separa acentos
        .replace(/[\u0300-\u036f]/g, ""); // elimina acentos
    }

    // Detectar si la sala pertenece a Fobia o a Action Gates
    const roomName = normalizeText(room.name);
    const isFobia =
      roomName.includes("piedra filosofal") ||
      roomName.includes("gulliver y los gigantes") ||
      roomName.includes("academia de houdini") ||
      roomName.includes("casa de los fantasmas");

    const start = new Date(reservation.start);
    const end = new Date(reservation.end);
    const [year, month, day] = [
      start.getFullYear(),
      String(start.getMonth() + 1).padStart(2, "0"),
      String(start.getDate()).padStart(2, "0"),
    ];
    const fechaBonita = `${day}/${month}/${year}`;

    // Datos comunes
    const cliente = customer.name?.split(" ")[0] ?? "jugador/a";
    const horaInicio = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
    const horaFin = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
    const fechaHora = `${fechaBonita} – ${horaInicio} a ${horaFin}`;
    const jugadores = `${reservation.players} jugadores`;
    
    // 💸 Precio original y final (si cupón)
    const originalPrice = Number(priceRow?.price ?? 0);
    const finalPrice = Number(price ?? 0);
    let precioHTML = `${finalPrice.toFixed(2)} €`;

    if (v.couponCode && v.discountType && v.discountValue) {
      const descuento =
        v.discountType === "percent"
          ? `-${v.discountValue}%`
          : `-${v.discountValue.toFixed(2)} €`;

      precioHTML = `
        <span style="text-decoration:line-through;color:#999;">
          ${originalPrice.toFixed(2)} €
        </span>
        <strong style="color:#388e3c;"> ${finalPrice.toFixed(2)} €</strong><br/>
        <small style="color:#388e3c;font-size:13px;">
          Cupón aplicado: <strong>${v.couponCode}</strong> (${descuento})
        </small>
      `;
    }



    // 🧩 Plantillas HTML (idénticas al POST)
    const fobiaHTML = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;background-color:#f6f8fa;padding:30px;">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#3f51b5,#1a237e);color:white;padding:24px;">
        <h1 style="margin:0;font-size:22px;">¡Hola, ${cliente}!</h1>
      </div>

      <div style="padding:28px;color:#333;">
        <p>Tu reserva en <strong>Fobia Escape Rooms Valencia</strong> está confirmada:</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td><strong>Sala:</strong></td><td>${room.name}</td></tr>
          <tr><td><strong>Nº de jugadores:</strong></td><td>${jugadores}</td></tr>
          <tr><td><strong>Fecha y hora:</strong></td><td>${fechaHora}</td></tr>
          <tr><td><strong>Precio:</strong></td><td>${precioHTML}</td></tr>

        </table>

        <p>Se os ruega llegar 15 minutos antes de la hora reservada para rellenar documentos necesarios para la realización de la sala y explicaros las normas, evitando perder tiempo de juego.</p>

        <h3 style="margin-top:24px;">📍 Nuestra ubicación</h3>
        <p>Plaza del Portal Nuevo, 8, Ciutat Vella, 46003 Valencia</p>
        <p><a href="https://maps.google.com/?q=Plaza+del+Portal+Nuevo,+8,+46003+Valencia" style="color:#3f51b5;">Abrir ubicación en Google Maps</a></p>

        <p>En la zona no es fácil encontrar parking gratuito. Recomendamos venir con tiempo, usar transporte público o aparcar en el Parking La Torreta (a 3 minutos caminando):</p>
        <p><a href="https://maps.google.com/?q=Parking+La+Torreta+Valencia" style="color:#3f51b5;">Abrir Parking La Torreta en Google Maps</a></p>

        <p>Para esta experiencia recomendamos ropa y calzado cómodo.</p>

        <h3 style="margin-top:24px;">⚠️ Atención jugadores</h3>
        <p>Si llegáis 10 minutos tarde, el juego podría acortarse. Si llegáis más de 15 minutos tarde, podríais perder la reserva.</p>

        <p>Si necesitas cancelar la reserva, hazlo con al menos 24 horas de antelación:</p>
        <a href="https://escaperoom-crm.vercel.app/api/reservations/${String(
          _id
        )}/cancel" style="display:inline-block;background:#3f51b5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Cancelar mi reserva</a>

        <p style="margin-top:24px;">Os esperamos con mucha ilusión 💥<br/><strong>Equipo de Fobia Escape</strong></p>

        <hr style="margin:30px 0;border:none;border-top:1px solid #ddd;" />
        <p style="font-size:13px;color:#555;">📧 valencia@fobiaescape.com · 📞 +34 654 60 89 75</p>
      </div>
    </div>
  </div>`;

    const actionHTML = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;background-color:#f6f8fa;padding:30px;">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#00796b,#00a884);color:white;padding:24px;">
        <h1 style="margin:0;font-size:22px;">¡Hola, ${cliente}!</h1>
      </div>

      <div style="padding:28px;color:#333;">
        <p>Tu reserva en <strong>Action Gates Skill Room Valencia</strong> está confirmada:</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td><strong>Misión:</strong></td><td>${room.name}</td></tr>
          <tr><td><strong>Nº de jugadores:</strong></td><td>${jugadores}</td></tr>
          <tr><td><strong>Fecha y hora:</strong></td><td>${fechaHora}</td></tr>
          <tr><td><strong>Precio:</strong></td><td>${precioHTML}</td></tr>

        </table>

        <p>Se os ruega llegar 15 minutos antes de la hora reservada para rellenar documentos necesarios, explicaros las normas y evitar perder tiempo de juego.</p>

        <h3 style="margin-top:24px;">📍 Nuestra ubicación</h3>
        <p>C/ dels Centelles, 58, L'Eixample, 46006 València, Valencia</p>
        <p><a href="https://maps.google.com/?q=Carrer+dels+Centelles+58,+Valencia" style="color:#00a884;">Abrir ubicación en Google Maps</a></p>

        <p>Recomendamos venir con tiempo o usar transporte público. Hay múltiples aparcamientos de pago cercanos.</p>

        <p>Para esta experiencia recomendamos ropa y calzado cómodo.</p>

        <h3 style="margin-top:24px;">⚠️ Atención jugadores</h3>
        <p>Si llegáis 10 minutos tarde, el juego podría acortarse. Si llegáis más de 15 minutos tarde, podríais perder la reserva.</p>

        <p>Si necesitas cancelar la reserva, hazlo con al menos 24 horas de antelación:</p>
        <a href="https://escaperoom-crm.vercel.app/api/reservations/${String(
          _id
        )}/cancel" style="display:inline-block;background:#00a884;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Cancelar mi reserva</a>

        <p style="margin-top:24px;">¡Nos vemos pronto para vivir una aventura inolvidable!<br/><strong>Equipo de Action Gates</strong></p>

        <hr style="margin:30px 0;border:none;border-top:1px solid #ddd;" />
        <p style="font-size:13px;color:#555;">📧 valencia@action-gates.com · 📞 +34 692 502 258</p>
      </div>
    </div>
  </div>`;


  const fobiaCancelHTML = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;background:#f6f8fa;padding:30px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#e53935,#b71c1c);color:white;padding:24px;">
        <h1 style="margin:0;font-size:22px;">Reserva cancelada</h1>
      </div>
      <div style="padding:28px;color:#333;">
        <p>Hola ${cliente},</p>
        <p>Tu reserva en <strong>Fobia Escape Rooms Valencia</strong> ha sido cancelada correctamente.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td><strong>Sala:</strong></td><td>${room.name}</td></tr>
          <tr><td><strong>Nº de jugadores:</strong></td><td>${jugadores}</td></tr>
          <tr><td><strong>Fecha y hora:</strong></td><td>${fechaHora}</td></tr>
          <tr><td><strong>Precio:</strong></td><td>${precioHTML}</td></tr>

        </table>
        <p>Esperamos verte pronto para vivir otra aventura.</p>
        <p style="margin-top:24px;">📧 valencia@fobiaescape.com · 📞 +34 654 60 89 75</p>
      </div>
    </div>
  </div>`;

const actionCancelHTML = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;background:#f6f8fa;padding:30px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#00796b,#004d40);color:white;padding:24px;">
        <h1 style="margin:0;font-size:22px;">Reserva cancelada</h1>
      </div>
      <div style="padding:28px;color:#333;">
        <p>Hola ${cliente},</p>
        <p>Tu reserva en <strong>Action Gates Skill Room Valencia</strong> ha sido cancelada correctamente.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td><strong>Misión:</strong></td><td>${room.name}</td></tr>
          <tr><td><strong>Nº de jugadores:</strong></td><td>${jugadores}</td></tr>
          <tr><td><strong>Fecha y hora:</strong></td><td>${fechaHora}</td></tr>
          <tr><td><strong>Precio:</strong></td><td>${precioHTML}</td></tr>

        </table>
        <p>Esperamos verte pronto para otra misión.</p>
        <p style="margin-top:24px;">📧 valencia@action-gates.com · 📞 +34 692 502 258</p>
      </div>
    </div>
  </div>`;


    let htmlContent = "";
    let subject = "";

    if (body.status === "cancelada") {
      // --- Plantilla personalizada de cancelación ---
      htmlContent = isFobia ? fobiaCancelHTML : actionCancelHTML;
      subject = isFobia
        ? `❌ Tu reserva en Fobia Escape Rooms ha sido cancelada`
        : `❌ Tu reserva en Action Gates Skill Room ha sido cancelada`;
    } else {
      // --- Plantillas de confirmación / modificación existentes ---
      htmlContent = isFobia ? fobiaHTML : actionHTML;
      subject = isFobia
        ? `🔐 Tu reserva en Fobia Escape Rooms – ${room.name}`
        : `🎯 Tu reserva en Action Gates Skill Room – ${room.name}`;
    }

    // finalmente, el envío del correo:
    await transporter.sendMail({
      from: isFobia
        ? '"Fobia Escape Room" <valencia@fobiaescape.com>'
        : '"Action Gates" <valencia@action-gates.com>',
      to: customer.email,
      bcc: "joseordazsuay@gmail.com",
      subject,
      html: htmlContent,
    });
      } catch (err) {
        console.error("Error enviando correo:", err);
      }
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
