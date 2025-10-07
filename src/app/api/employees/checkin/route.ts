import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";

/* Registrar fichaje */
export async function POST(req: NextRequest) {
  try {
    const db = await connectDB();
    const { employeeId, type } = await req.json();

    if (!employeeId || !type)
      return NextResponse.json(
        { ok: false, error: "Datos incompletos" },
        { status: 400 }
      );

    const record = {
      employeeId: new ObjectId(employeeId),
      type,
      time: new Date(),
    };

    await db.collection("checkins").insertOne(record);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

/* Obtener fichajes con estado actual */
export async function GET() {
  try {
    const db = await connectDB();

    const all = await db
      .collection("checkins")
      .aggregate([
        {
          $lookup: {
            from: "employees",
            localField: "employeeId",
            foreignField: "_id",
            as: "employee",
          },
        },
        { $unwind: "$employee" },
        { $sort: { time: -1 } },
      ])
      .toArray();

    // Último registro de cada empleado
    const latestByEmployee: Record<string, any> = {};
    for (const r of all) {
      const id = r.employeeId.toString();
      if (!latestByEmployee[id]) latestByEmployee[id] = r;
    }

    return NextResponse.json({
      all, // todos los registros
      active: Object.values(latestByEmployee).filter((r: any) => r.type === "in"), // solo los activos
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
