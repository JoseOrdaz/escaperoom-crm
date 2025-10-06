import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

/* GET → listado de clientes con número de reservas */
export async function GET() {
  try {
    const db = await connectDB();

    const customers = await db
      .collection("customers")
      .find({}, { projection: { name: 1, email: 1, phone: 1 } })
      .sort({ name: 1 })
      .toArray();

    const counts = await db
      .collection("reservations")
      .aggregate([
        { $match: { customerId: { $exists: true, $ne: null } } },
        { $group: { _id: "$customerId", count: { $sum: 1 } } },
      ])
      .toArray();

    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    return NextResponse.json({
      items: customers.map((c) => ({
        _id: String(c._id),
        name: c.name ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        reservationsCount: countMap.get(String(c._id)) ?? 0,
      })),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

/* POST → crear nuevo cliente */
export async function POST(req: Request) {
  try {
    const db = await connectDB();
    const body = await req.json();

    if (!body.name || !body.email) {
      return NextResponse.json(
        { ok: false, error: "Nombre y email son obligatorios" },
        { status: 400 }
      );
    }

    const res = await db.collection("customers").insertOne({
      name: body.name,
      email: body.email.toLowerCase().trim(),
      phone: body.phone ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, _id: String(res.insertedId) });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
