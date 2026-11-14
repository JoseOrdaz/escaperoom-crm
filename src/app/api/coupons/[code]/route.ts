import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAccess } from "@/lib/access";

/* DELETE → eliminar un cupón por su código */
export async function DELETE(req: Request, context: { params: Promise<{ code: string }> }) {
  const auth = await requireAccess(req, "coupons.manage");
  if (auth.response) return auth.response;
  const { code } = await context.params;
  const db = await connectDB();
  const res = await db.collection("coupons").deleteOne({ code: decodeURIComponent(code).toUpperCase() });
  if (res.deletedCount === 0) return NextResponse.json({ ok: false, error: "Cupón no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/* PATCH → editar un cupón (también si está caducado o agotado) */
const patchSchema = z.object({
  type: z.enum(["percent", "amount"]).optional(),
  value: z.coerce.number().positive("El valor debe ser mayor que 0").optional(),
  roomId: z.string().regex(/^[a-f0-9]{24}$/i).nullable().or(z.literal("")).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  maxUses: z.coerce.number().int().min(1).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ code: string }> }) {
  const auth = await requireAccess(req, "coupons.manage");
  if (auth.response) return auth.response;
  const { code } = await context.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  if (d.type === "percent" && d.value !== undefined && d.value > 100) {
    return NextResponse.json({ ok: false, error: "Un porcentaje no puede ser mayor que 100" }, { status: 400 });
  }
  if (d.startDate && d.endDate && d.endDate < d.startDate) {
    return NextResponse.json({ ok: false, error: "La fecha de fin es anterior a la de inicio" }, { status: 400 });
  }

  const $set: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["type", "value", "startDate", "endDate", "maxUses", "active"] as const) if (d[k] !== undefined) $set[k] = d[k];
  if (d.roomId !== undefined) $set.roomId = d.roomId ? new ObjectId(d.roomId) : null;

  const db = await connectDB();
  const res = await db.collection("coupons").updateOne({ code: decodeURIComponent(code).toUpperCase() }, { $set });
  if (res.matchedCount === 0) return NextResponse.json({ ok: false, error: "Cupón no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
