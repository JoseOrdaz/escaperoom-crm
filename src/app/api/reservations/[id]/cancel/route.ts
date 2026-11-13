import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { createMailer } from "@/lib/mailer";

/* ───────── GET o POST ───────── */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return cancelReservation(params.id);
}

// export async function POST(req: Request, { params }: { params: { id: string } }) {
//   return cancelReservation(params.id);
// }

/* ───────── Lógica común ───────── */
async function cancelReservation(reservationId: string) {

  
  try {
    const db = await connectDB();

    if (!ObjectId.isValid(reservationId)) {
      return NextResponse.json(
        { ok: false, error: "ID de reserva inválido" },
        { status: 400 }
      );
    }

    const _id = new ObjectId(reservationId);

    const reservation = await db.collection("reservations").findOne({ _id });
    if (!reservation) {
      return NextResponse.redirect("https://escaperoom-crm.vercel.app/cancelacion-error");
    }

    // 🛡️ Protección contra doble ejecución (prefetch o clic repetido)
    if (reservation.status === "cancelada") {
      console.log("Reserva ya cancelada, no se reenvía correo.");
      return NextResponse.redirect("https://escaperoom-crm.vercel.app/cancelada");
    }

    await db
      .collection("reservations")
      .updateOne({ _id }, { $set: { status: "cancelada", updatedAt: new Date() } });

    /* ─────────────── Envío de correo de cancelación ─────────────── */
    try {
      const customer = reservation.customerId
        ? await db.collection("customers").findOne({ _id: reservation.customerId })
        : null;
      if (!customer?.email) throw new Error("Cliente sin email");

      const room = await db.collection("rooms").findOne({ _id: reservation.roomId });
      if (!room) throw new Error("Sala no encontrada");

      const transporter = createMailer();

      const normalizeText = (text: string) =>
        text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const isFobia = [
        "piedra filosofal",
        "gulliver y los gigantes",
        "academia de houdini",
        "casa de los fantasmas",
      ].some((name) => normalizeText(room.name).includes(name));

      const cliente = customer.name?.split(" ")[0] ?? "jugador/a";

      // Fechas y datos visuales
      const start = new Date(reservation.start);
      const end = new Date(reservation.end);
      const [year, month, day] = [
        start.getFullYear(),
        String(start.getMonth() + 1).padStart(2, "0"),
        String(start.getDate()).padStart(2, "0"),
      ];
      const fechaBonita = `${day}/${month}/${year}`;
      const horaInicio = `${String(start.getHours()).padStart(2, "0")}:${String(
        start.getMinutes()
      ).padStart(2, "0")}`;
      const horaFin = `${String(end.getHours()).padStart(2, "0")}:${String(
        end.getMinutes()
      ).padStart(2, "0")}`;
      const fechaHora = `${fechaBonita} – ${horaInicio} a ${horaFin}`;
      const jugadores = `${reservation.players} jugadores`;
      const precio = (
        room.priceTable?.find((p: any) => p.players === reservation.players)?.price ?? 0
      ).toFixed(2);

      const fobiaCancelHTML = `
        <div style="font-family:'Segoe UI',Tahoma,sans-serif;background:#f6f8fa;padding:30px;">
          <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1)">
            <div style="background:linear-gradient(135deg,#e53935,#b71c1c);color:white;padding:24px;">
              <h1 style="margin:0;font-size:22px;">Reserva cancelada</h1>
            </div>
            <div style="padding:28px;color:#333;">
              <p>Hola ${cliente},</p>
              <p>Tu reserva en <strong>Fobia Escape Rooms Valencia</strong> ha sido <strong>cancelada correctamente</strong>.</p>
              
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td><strong>Sala:</strong></td><td>${room.name}</td></tr>
                <tr><td><strong>Nº de jugadores:</strong></td><td>${jugadores}</td></tr>
                <tr><td><strong>Fecha y hora:</strong></td><td>${fechaHora}</td></tr>
                <tr><td><strong>Precio:</strong></td><td>${precio} €</td></tr>
              </table>

              <p>Esperamos verte pronto para vivir otra aventura con nosotros.</p>
              <p style="margin-top:24px;">📧 valencia@fobiaescape.com · 📞 +34 654 60 89 75</p>
            </div>
          </div>
        </div>`;

      const actionCancelHTML = `
        <div style="font-family:'Segoe UI',Tahoma,sans-serif;background:#f6f8fa;padding:30px;">
          <div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1)">
            <div style="background:linear-gradient(135deg,#e53935,#b71c1c);color:white;padding:24px;">
              <h1 style="margin:0;font-size:22px;">Reserva cancelada</h1>
            </div>
            <div style="padding:28px;color:#333;">
              <p>Hola ${cliente},</p>
              <p>Tu reserva en <strong>Action Gates Skill Room Valencia</strong> ha sido <strong>cancelada correctamente</strong>.</p>
              
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td><strong>Misión:</strong></td><td>${room.name}</td></tr>
                <tr><td><strong>Nº de jugadores:</strong></td><td>${jugadores}</td></tr>
                <tr><td><strong>Fecha y hora:</strong></td><td>${fechaHora}</td></tr>
                <tr><td><strong>Precio:</strong></td><td>${precio} €</td></tr>
              </table>

              <p>Esperamos verte pronto para una nueva misión.</p>
              <p style="margin-top:24px;">📧 valencia@action-gates.com · 📞 +34 692 502 258</p>
            </div>
          </div>
        </div>`;

      const html = isFobia ? fobiaCancelHTML : actionCancelHTML;
      const subject = isFobia
        ? `❌ Tu reserva en Fobia Escape Rooms ha sido cancelada`
        : `❌ Tu reserva en Action Gates Skill Room ha sido cancelada`;

      await transporter.sendMail({
        from: isFobia
          ? '"Fobia Escape Room" <valencia@fobiaescape.com>'
          : '"Action Gates" <valencia@action-gates.com>',
        to: customer.email,
        bcc: "joseordazsuay@gmail.com",
        subject,
        html,
      });
    } catch (err) {
      console.error("Error enviando correo de cancelación:", err);
    }

    // ✅ Redirigir a página de confirmación visual dentro del CRM
    return NextResponse.redirect("https://escaperoom-crm.vercel.app/cancelada");
  } catch (err) {
    console.error("Error cancelando reserva:", err);
    return NextResponse.json(
      { ok: false, error: "Error al cancelar la reserva" },
      { status: 500 }
    );
  }
}
