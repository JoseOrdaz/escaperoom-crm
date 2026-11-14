import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
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
