import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAccess } from "@/lib/access";
import { escapeToBrand } from "@/lib/permissions";
import { listRecipients } from "@/lib/newsletter";

/* GET → clientes con email, sus locales (Fobia / Action Gates) y si se dieron de baja */
export async function GET() {
  const auth = await requireAccess(null, "newsletter.send");
  if (auth.response) return auth.response;
  const brands = auth.access.escapes.map(escapeToBrand);
  const fullAccess = brands.includes("fobia") && brands.includes("action");
  const db = await connectDB();
  const items = (await listRecipients(db)).filter((r) => fullAccess || r.venues.some((v) => brands.includes(v)));
  return NextResponse.json({ ok: true, items, brands });
}
