import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";

/* ========= Crear cupón ========= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = await connectDB();

    const {
      code,
      type,
      value,
      roomId,
      startDate,
      endDate,
      maxUses = 1,
    } = body;

    if (!code || !type || !value)
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios" },
        { status: 400 }
      );

    const coupon = {
      code: code.toUpperCase(),
      type, // 'percent' | 'amount'
      value: Number(value),
      roomId: roomId ? new ObjectId(roomId) : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxUses: Number(maxUses),
      usedCount: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("coupons").insertOne(coupon);

    return NextResponse.json({ ok: true, coupon });
  } catch (error) {
    console.error("Error creando cupón:", error);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

/* ========= Listar cupones ========= */
export async function GET() {
  try {
    const db = await connectDB();
    const coupons = await db.collection("coupons").find().sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ ok: true, coupons });
  } catch (error) {
    console.error("Error listando cupones:", error);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
