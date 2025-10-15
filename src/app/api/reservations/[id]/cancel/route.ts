import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";

/* ───────── GET o POST ───────── */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  return cancelReservation(params.id);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  return cancelReservation(params.id);
}

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

    const result = await db.collection("reservations").updateOne(
      { _id: new ObjectId(reservationId) },
      { $set: { status: "cancelada", updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      // Si no existe o ya estaba cancelada
      return NextResponse.redirect("https://escaperoom-crm.vercel.app/cancelacion-error");
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
