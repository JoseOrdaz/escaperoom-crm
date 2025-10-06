import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

export async function POST(req: Request) {
  const db = await connectDB();
  const { email, type } = await req.json();

  if (!email || !["in", "out"].includes(type))
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const employee = await db.collection("employees").findOne({ email });
  if (!employee)
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });

  const checkin = {
    type,
    timestamp: new Date(),
  };

  await db.collection("employees").updateOne(
    { email },
    { $push: { checkins: checkin } }
  );

  return NextResponse.json(checkin);
}
