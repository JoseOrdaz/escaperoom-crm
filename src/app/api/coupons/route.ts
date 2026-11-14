import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";
import { requireAccess } from "@/lib/access";

/* ========= Crear cupón ========= */
export async function POST(req: NextRequest) {
  const auth = await requireAccess(req, "coupons.manage");
  if (auth.response) return auth.response;
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
    if (type === "percent" && Number(value) > 100)
      return NextResponse.json({ ok: false, error: "Un porcentaje no puede ser mayor que 100" }, { status: 400 });
    if (await db.collection("coupons").findOne({ code: String(code).trim().toUpperCase() }))
      return NextResponse.json({ ok: false, error: "Ya existe un cupón con ese código" }, { status: 409 });

    const coupon = {
      code: String(code).trim().toUpperCase(),
      type, // 'percent' | 'amount'
      value: Number(value),
      roomId: roomId && /^[a-f0-9]{24}$/i.test(roomId) ? new ObjectId(roomId) : null,
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
