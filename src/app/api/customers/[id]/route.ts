import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAccess } from "@/lib/access";
import { ObjectId } from "mongodb";

/* ───────────────────────────────
   GET → obtener cliente por ID
──────────────────────────────── */
export async function GET(req: NextRequest, context: any) {
  const auth = await requireAccess(null);
  if (auth.response) return auth.response;
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
  const auth = await requireAccess(req, "reservations.edit");
  if (auth.response) return auth.response;
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
  const auth = await requireAccess(req, "reservations.delete");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    const _id = new ObjectId(id);
    const db = await connectDB();

    // ?reservations=delete → borra también sus reservas · unlink → las deja sin cliente
    const mode = new URL(req.url).searchParams.get("reservations");
    const count = await db.collection("reservations").countDocuments({ customerId: _id });
    if (count > 0 && mode !== "delete" && mode !== "unlink") {
      return NextResponse.json(
        { ok: false, error: `El cliente tiene ${count} reservas`, reservations: count, needsChoice: true },
        { status: 409 }
      );
    }
    if (count > 0 && mode === "delete") await db.collection("reservations").deleteMany({ customerId: _id });
    if (count > 0 && mode === "unlink") {
      await db.collection("reservations").updateMany({ customerId: _id }, { $unset: { customerId: "" }, $set: { updatedAt: new Date() } });
    }

    const res = await db.collection("customers").deleteOne({ _id });
    if (res.deletedCount === 0) {
      return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, reservations: count, mode: count ? mode : null });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
