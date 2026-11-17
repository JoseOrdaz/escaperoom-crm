import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { sendReservationEmail } from "@/lib/reservation-emails";

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

    /* ─────────────── Correo de cancelación (plantilla editable en Ajustes) ─────────────── */
    try {
      await sendReservationEmail(db, { reservationId: _id, kind: "status", trigger: "auto", event: "cancelled", template: "cancelled" });
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
