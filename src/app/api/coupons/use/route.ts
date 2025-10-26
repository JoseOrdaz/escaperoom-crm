import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) return NextResponse.json({ ok: false, error: "Falta código" });

    const db = await connectDB();
    const result = await db
      .collection("coupons")
      .updateOne({ code: code.toUpperCase() }, { $inc: { usedCount: 1 }, $set: { updatedAt: new Date() } });

    if (result.matchedCount === 0)
      return NextResponse.json({ ok: false, error: "Cupón no encontrado" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error actualizando cupón:", error);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
