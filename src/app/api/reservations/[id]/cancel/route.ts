import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = await connectDB();
    const reservationId = params.id;

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
      return NextResponse.json(
        { ok: false, error: "Reserva no encontrada o ya cancelada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, message: "Reserva cancelada" });
  } catch (err: any) {
    console.error("Error cancelando reserva:", err);
    return NextResponse.json(
      { ok: false, error: "Error al cancelar la reserva" },
      { status: 500 }
    );
  }
}
