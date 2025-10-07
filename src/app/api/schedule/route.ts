import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";

/* ─────────────── Tipos ─────────────── */
type Shift = {
  employeeId: ObjectId;
  start: string;
  end: string;
};

type WorkSchedule = {
  _id?: ObjectId;
  date: string;
  escape: string;
  shifts: Shift[];
};

/* ──────────────────────────────────────────────── */
/* GET → Obtener horarios laborales por escape     */
/* ──────────────────────────────────────────────── */
export async function GET(req: Request) {
  try {
    const db = await connectDB();
    const schedules = db.collection<WorkSchedule>("work_schedules");

    const { searchParams } = new URL(req.url);
    const escape = searchParams.get("escape") || "Fobia";

    const results = await schedules
      .find({ escape })
      .sort({ date: 1 })
      .toArray();

    return NextResponse.json(results);
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
    const schedules = db.collection<WorkSchedule>("work_schedules");

    const body = await req.json();
    const { date, escape, employeeId, start, end } = body;

    if (!date || !employeeId || !start || !end) {
      return NextResponse.json(
        { ok: false, error: "Datos incompletos" },
        { status: 400 }
      );
    }

    const schedule = await schedules.findOne({ date, escape });

    const newShift: Shift = {
      employeeId: new ObjectId(employeeId),
      start,
      end,
    };

    if (schedule) {
      // comprobar si el turno ya existe
      const exists = schedule.shifts?.some(
        (s) =>
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

      await schedules.updateOne(
        { _id: schedule._id },
        { $push: { shifts: newShift } }
      );
    } else {
      await schedules.insertOne({
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
