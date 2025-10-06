import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function GET() {
  const db = await connectDB();
  const employees = await db.collection("employees").find().toArray();
  return NextResponse.json(employees);
}

export async function POST(req: Request) {
  const db = await connectDB();
  const body = await req.json();

  const newEmp = {
    avatar: body.avatar || "",
    name: body.name,
    surname: body.surname,
    email: body.email,
    role: body.role,
    weeklySchedule: body.weeklySchedule || {
      monday: { start: "", end: "", rooms: [] },
      tuesday: { start: "", end: "", rooms: [] },
      wednesday: { start: "", end: "", rooms: [] },
      thursday: { start: "", end: "", rooms: [] },
      friday: { start: "", end: "", rooms: [] },
      saturday: { start: "", end: "", rooms: [] },
      sunday: { start: "", end: "", rooms: [] },
    },
    checkins: [],
    createdAt: new Date(),
  };

  const result = await db.collection("employees").insertOne(newEmp);
  return NextResponse.json({ _id: result.insertedId, ...newEmp });
}

export async function PUT(req: Request) {
  const db = await connectDB();
  const body = await req.json();

  if (!body._id) return NextResponse.json({ error: "Falta el ID" }, { status: 400 });

  const id = new ObjectId(body._id);
  delete body._id;
  await db.collection("employees").updateOne({ _id: id }, { $set: body });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const db = await connectDB();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  await db.collection("employees").deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ ok: true });
}
