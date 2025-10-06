import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";

/* ───────────────────────────────
   GET → obtener cliente por ID
──────────────────────────────── */
export async function GET(req: NextRequest, context: any) {
  try {
    const db = await connectDB();
    const customer = await db
      .collection("customers")
      .findOne({ _id: new ObjectId(context.params.id) });

    if (!customer) {
      return NextResponse.json(
        { ok: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      _id: String(customer._id),
      name: customer.name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

/* ───────────────────────────────
   PUT → actualizar cliente
──────────────────────────────── */
export async function PUT(req: NextRequest, context: any) {
  try {
    const db = await connectDB();
    const body = await req.json();
    const { name, email, phone } = body;

    const res = await db.collection("customers").updateOne(
      { _id: new ObjectId(context.params.id) },
      {
        $set: {
          name: name ?? "",
          email: email?.toLowerCase().trim() ?? "",
          phone: phone ?? "",
          updatedAt: new Date(),
        },
      }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json(
        { ok: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

/* ───────────────────────────────
   DELETE → eliminar cliente
──────────────────────────────── */
export async function DELETE(req: NextRequest, context: any) {
  try {
    const db = await connectDB();
    const res = await db
      .collection("customers")
      .deleteOne({ _id: new ObjectId(context.params.id) });

    if (res.deletedCount === 0) {
      return NextResponse.json(
        { ok: false, error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
