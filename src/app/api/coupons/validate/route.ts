import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function POST(req: NextRequest) {
  try {
    const { code, roomId, date } = await req.json();
    if (!code) return NextResponse.json({ valid: false, message: "Falta el código" });

    const db = await connectDB();
    const coupon = await db.collection("coupons").findOne({ code: code.toUpperCase(), active: true });

    if (!coupon) return NextResponse.json({ valid: false, message: "Cupón no encontrado o inactivo" });

    const now = date ? new Date(date) : new Date();

    if (now < new Date(coupon.startDate) || now > new Date(coupon.endDate))
      return NextResponse.json({ valid: false, message: "Cupón fuera de fecha" });

    if (coupon.usedCount >= coupon.maxUses)
      return NextResponse.json({ valid: false, message: "Cupón agotado" });

    if (coupon.roomId && roomId && coupon.roomId.toString() !== roomId)
      return NextResponse.json({ valid: false, message: "No válido para esta sala" });

    return NextResponse.json({
      valid: true,
      type: coupon.type,
      value: coupon.value,
      message: "Cupón válido ✅",
    });
  } catch (error) {
    console.error("Error validando cupón:", error);
    return NextResponse.json({ valid: false, message: "Error interno" });
  }
}
