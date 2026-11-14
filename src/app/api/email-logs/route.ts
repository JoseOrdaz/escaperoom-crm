import { NextResponse } from "next/server";
import { ObjectId, type Filter, type Document } from "mongodb";
import { connectDB } from "@/lib/db";
import { currentProfile } from "@/lib/profile-session";

/* GET → registro de correos enviados
   ?trigger=auto|manual  ?reservationId=<id>  ?status=sent|error  ?page=1&pageSize=50  ?withHtml=1 */
export async function GET(req: Request) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "Inicia sesión de nuevo" }, { status: 401 });

  const sp = new URL(req.url).searchParams;

  // Un único registro con su HTML (para la vista previa)
  const oneId = sp.get("id");
  if (oneId) {
    if (!/^[a-f0-9]{24}$/i.test(oneId)) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    const db = await connectDB();
    const log = await db.collection("email_logs").findOne({ _id: new ObjectId(oneId) });
    if (!log) return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, item: { ...log, _id: String(log._id) } });
  }

  const filter: Filter<Document> = {};
  const trigger = sp.get("trigger");
  if (trigger === "auto" || trigger === "manual") filter.trigger = trigger;
  const status = sp.get("status");
  if (status === "sent" || status === "error") filter.status = status;
  const reservationId = sp.get("reservationId");
  if (reservationId) {
    if (!/^[a-f0-9]{24}$/i.test(reservationId)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    filter.reservationId = new ObjectId(reservationId);
  }

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 50));
  const withHtml = sp.get("withHtml") === "1";

  const db = await connectDB();
  const col = db.collection("email_logs");
  const [items, total] = await Promise.all([
    col
      .find(filter, withHtml ? {} : { projection: { html: 0 } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    col.countDocuments(filter),
  ]);

  return NextResponse.json({
    ok: true,
    total,
    page,
    pageSize,
    items: items.map((l) => ({
      ...l,
      _id: String(l._id),
      reservationId: l.reservationId ? String(l.reservationId) : null,
      customerId: l.customerId ? String(l.customerId) : null,
    })),
  });
}
