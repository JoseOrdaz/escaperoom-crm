import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";

/* ──────────────────────────────────────────────── */
/* GET → Obtener horarios laborales por escape     */
/* ──────────────────────────────────────────────── */
export async function GET(req: Request) {
  try {
    const db = await connectDB();
    const { searchParams } = new URL(req.url);
    const escape = searchParams.get("escape") || "Fobia";

    const schedules = await db
      .collection("work_schedules")
      .find({ escape })
      .sort({ date: 1 })
      .toArray();

    return NextResponse.json(schedules);
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

/* ──────────────────────────────────────────────── */
/* POST → Crear o añadir turno en un día existente  */
/* ──────────────────────────────────────────────── */
export async function POST(req: Request) {
  try {
    const db = await connectDB();
    const body = await req.json();

    const { date, escape, employeeId, start, end } = body;

    if (!date || !employeeId || !start || !end) {
      return NextResponse.json(
        { ok: false, error: "Datos incompletos" },
        { status: 400 }
      );
    }

    const schedule = await db
      .collection("work_schedules")
      .findOne({ date, escape });

    const newShift = {
      employeeId: new ObjectId(employeeId),
      start,
      end,
    };

    if (schedule) {
      // Comprobar si ya existe el mismo turno para ese empleado
      const exists = schedule.shifts?.some(
        (s: any) =>
          String(s.employeeId) === String(employeeId) &&
          s.start === start &&
          s.end === end
      );

      if (exists) {
        return NextResponse.json(
          { ok: false, error: "El turno ya existe para ese empleado" },
          { status: 400 }
        );
      }

      await db.collection("work_schedules").updateOne(
        { _id: schedule._id },
        { $push: { shifts: newShift } }
      );
    } else {
      await db.collection("work_schedules").insertOne({
        date,
        escape,
        shifts: [newShift],
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
