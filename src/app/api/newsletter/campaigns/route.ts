import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAccess } from "@/lib/access";
import { escapeToBrand } from "@/lib/permissions";

/* GET → historial de envíos de newsletter / avisos */
export async function GET() {
  const auth = await requireAccess(null, "newsletter.send");
  if (auth.response) return auth.response;
  const db = await connectDB();
  const brands = auth.access.escapes.map(escapeToBrand);
  const items = await db.collection("email_campaigns").find({ brand: { $in: brands } }).sort({ createdAt: -1 }).limit(100).toArray();
  return NextResponse.json({ ok: true, items: items.map((c) => ({ ...c, _id: String(c._id) })) });
}
