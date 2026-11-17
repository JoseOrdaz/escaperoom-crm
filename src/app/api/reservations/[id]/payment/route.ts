import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { canUseRoom, forbiddenRoom, requireAccess } from "@/lib/access";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments";

const bodySchema = z.object({
  status: z.enum(["pendiente", "parcial", "pagado"]),
  paidAmount: z.number().min(0).max(100000),
  method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]).nullable(),
  note: z.string().trim().max(300).optional(),
});

/* PUT → registrar el cobro de una reserva */
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAccess(req, "payments.manage");
  if (auth.response) return auth.response;

  const { id } = await context.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const db = await connectDB();
  const _id = new ObjectId(id);
  const target = await db.collection("reservations").findOne({ _id }, { projection: { roomId: 1, price: 1, payment: 1 } });
  if (!target) return NextResponse.json({ ok: false, error: "Reserva no encontrada" }, { status: 404 });
  if (!(await canUseRoom(db, auth.access, target.roomId))) return forbiddenRoom();

  const v = parsed.data;
  const payment = {
    status: v.status,
    paidAmount: v.status === "pendiente" ? 0 : Math.round(v.paidAmount * 100) / 100,
    method: v.status === "pendiente" ? null : v.method,
    paidAt: v.status === "pendiente" ? null : target.payment?.paidAt && target.payment.status !== "pendiente" ? target.payment.paidAt : new Date(),
    by: auth.access.name,
    note: v.note ?? "",
    updatedAt: new Date(),
  };
  await db.collection("reservations").updateOne({ _id }, { $set: { payment } });
  return NextResponse.json({ ok: true, payment });
}
