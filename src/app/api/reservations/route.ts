import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { z } from "zod";
import nodemailer from "nodemailer";


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

/* ───────── schema ───────── */
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
  notes: z.string().max(1000).optional().default(""),
  internalNotes: z.string().max(1000).optional().default(""),
  status: z.enum(["pendiente", "confirmada", "cancelada"]).default("pendiente"),
});

/* ───────── Caché en memoria (1 min) ───────── */
// const cache = new Map<string, { data: any; timestamp: number }>();
// async function getCached(key: string, fn: () => Promise<any>) {
//   const cached = cache.get(key);
//   if (cached && Date.now() - cached.timestamp < 60_000) {
//     return cached.data;
//   }
//   const data = await fn();
//   cache.set(key, { data, timestamp: Date.now() });
//   return data;
// }

/* ───────── GET ───────── */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // === Estadísticas globales ===
    if (searchParams.get("stats") === "1") {
      const db = await connectDB();
      const [totalReservations, reservationsThisMonth] = await Promise.all([
        db.collection("reservations").countDocuments(),
        (() => {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          return db.collection("reservations").countDocuments({
            start: { $gte: start, $lt: end },
          });
        })(),
      ]);

      return NextResponse.json({ totalReservations, reservationsThisMonth });
    }

    // === Por cliente ===
    const customerId = searchParams.get("customerId");
    if (customerId) {
      const db = await connectDB();
      const docs = await db
        .collection("reservations")
        .find({ customerId: safeObjectId(customerId) })
        .project({
          roomId: 1,
          roomName: 1,
          start: 1,
          end: 1,
          players: 1,
          price: 1,
          language: 1,
          notes: 1,
          internalNotes: 1,
          status: 1,
        })
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
          notes: d.notes ?? "",
          internalNotes: d.internalNotes ?? "",
          status: d.status ?? "pendiente",
        }))
      );
    }

    // === Por rango de fechas ===
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    const roomId = safeObjectId(searchParams.get("roomId") ?? "");

    if (!YMD.test(from) || !YMD.test(to)) {
      return NextResponse.json(
        { ok: false, error: "Parámetros from/to inválidos" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const fromD = toDateAtLocal(from, "00:00");
    const toD = toDateAtLocal(to, "00:00");

    const query: any = { start: { $gte: fromD }, end: { $lt: toD } };

    if (roomId) {
      const room = await db.collection("rooms").findOne({ _id: roomId });
      const linked = (room?.linkedRooms ?? [])
        .map((id: string) => safeObjectId(id))
        .filter(Boolean);
      query.roomId = { $in: [roomId, ...linked] };
    }

    // 🔥 consultas paralelas sin caché
    const docs = await db
      .collection("reservations")
      .find(query)
      .project({
        roomId: 1,
        start: 1,
        end: 1,
        players: 1,
        price: 1,
        language: 1,
        notes: 1,
        internalNotes: 1,
        status: 1,
        customerId: 1,
      })
      .sort({ start: 1 })
      .toArray();

    const roomIds = [...new Set(docs.map((d: any) => String(d.roomId)))];
    const custIds = [
      ...new Set(docs.map((d: any) => String(d.customerId)).filter(Boolean)),
    ];

    const [rooms, customers] = await Promise.all([
      db
        .collection("rooms")
        .find({
          _id: {
            $in: roomIds
              .map(safeObjectId)
              .filter((id): id is ObjectId => id !== null),
          },
        })
        .project({ _id: 1, name: 1 })
        .toArray(),
      custIds.length
        ? db
          .collection("customers")
          .find({
            _id: {
              $in: custIds
                .map(safeObjectId)
                .filter((id): id is ObjectId => id !== null),
            },
          })
          .project({ _id: 1, name: 1, email: 1, phone: 1 })
          .toArray()
        : Promise.resolve([]),
    ]);

    const roomMap = new Map(rooms.map((r) => [String(r._id), r.name]));
    const customerMap = new Map(customers.map((c) => [String(c._id), c]));

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

    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Error" },
      { status: 500 }
    );
  }
}


/* ───────── POST ───────── */
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

    // 🔒 comprobar conflictos
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
      notes: v.notes,
      internalNotes: v.internalNotes ?? "",
      ...(customerId ? { customerId } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: v.status,
    };

    const res = await db.collection("reservations").insertOne(doc);

    // ───────── Enviar correo de notificación ─────────


    try {
      const transporter = nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: {
          user: "joseordazsuay@gmail.com",
          pass: "JbLtCYxUfHn4awkh",
        },
      });
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

  const [year, month, day] = v.date.split("-");
  const fechaBonita = `${day}/${month}/${year}`;

  // Datos comunes
  const cliente = v.customerName?.split(" ")[0] ?? "jugador/a";
  const fechaHora = `${fechaBonita} – ${v.start}${v.end ? " a " + v.end : ""}`;
  const jugadores = `${v.players} jugadores`;
  const precio = (room.priceTable?.find(p => p.players === v.players)?.price ?? 0).toFixed(2);

  

  // 🧩 Plantillas HTML
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
          <tr><td><strong>Precio:</strong></td><td>${precio} €</td></tr>
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
        <a href="https://escaperoom-crm.vercel.app/api/reservations/${res.insertedId}/cancel" style="display:inline-block;background:#3f51b5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Cancelar mi reserva</a>

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
          <tr><td><strong>Precio:</strong></td><td>${precio} €</td></tr>
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
        <a href="https://escaperoom-crm.vercel.app/api/reservations/${res.insertedId}/cancel" style="display:inline-block;background:#00a884;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Cancelar mi reserva</a>

        <p style="margin-top:24px;">¡Nos vemos pronto para vivir una aventura inolvidable!<br/><strong>Equipo de Action Gates</strong></p>

        <hr style="margin:30px 0;border:none;border-top:1px solid #ddd;" />
        <p style="font-size:13px;color:#555;">📧 valencia@action-gates.com · 📞 +34 692 502 258</p>
      </div>
    </div>
  </div>`;

  // ✉️ Enviar correo según la sala
  const htmlContent = isFobia ? fobiaHTML : actionHTML;
  const subject = isFobia
    ? `🔐 Tu reserva en Fobia Escape Rooms – ${room.name}`
    : `🎯 Tu reserva en Action Gates Skill Room – ${room.name}`;

  await transporter.sendMail({
    from: isFobia
      ? '"Fobia Escape Room" <valencia@fobiaescape.com>'
      : '"Action Gates" <valencia@action-gates.com>',
    to: v.customerEmail,
    bcc: "joseordazsuay@gmail.com",
    subject,
    html: htmlContent,
  });
} catch (err) {
  console.error("Error enviando correo:", err);
}





    return NextResponse.json({ ok: true, _id: String(res.insertedId) }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Error" },
      { status: 500 }
    );
  }
}
