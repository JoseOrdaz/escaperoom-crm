import { NextResponse } from "next/server";
import { ObjectId, type Filter, type Document } from "mongodb";
import { connectDB } from "@/lib/db";
import { canUseRoom, forbiddenRoom, requireAccess } from "@/lib/access";
import { VENUES } from "@/lib/venues";
import { escapeToBrand } from "@/lib/permissions";

/* GET → registro de correos enviados
   ?trigger=auto|manual  ?reservationId=<id>  ?status=sent|error  ?page=1&pageSize=50  ?withHtml=1 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const reservationId = sp.get("reservationId");

  // El historial de una reserva lo puede ver quien ve esa reserva; el registro completo, solo admins
  const auth = await requireAccess(null, reservationId ? "reservations.view" : "emails.view");
  if (auth.response) return auth.response;
  // Solo correos enviados desde los remitentes de mis escapes
  const fromScope = { from: { $in: auth.access.escapes.map((e) => VENUES[escapeToBrand(e)].from) } };

  // Un único registro con su HTML (para la vista previa)
  const oneId = sp.get("id");
  if (oneId && !auth.access.can("emails.view")) return NextResponse.json({ ok: false, error: "No tienes permiso" }, { status: 403 });
  if (oneId) {
    if (!/^[a-f0-9]{24}$/i.test(oneId)) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    const db = await connectDB();
    const log = await db.collection("email_logs").findOne({ _id: new ObjectId(oneId), ...fromScope });
    if (!log) return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, item: { ...log, _id: String(log._id) } });
  }

  const filter: Filter<Document> = { ...fromScope };
  const trigger = sp.get("trigger");
  if (trigger === "auto" || trigger === "manual") filter.trigger = trigger;
  const status = sp.get("status");
  if (status === "sent" || status === "error") filter.status = status;
  const customerId = sp.get("customerId");
  if (customerId && /^[a-f0-9]{24}$/i.test(customerId)) filter.customerId = new ObjectId(customerId);
  if (reservationId) {
    if (!/^[a-f0-9]{24}$/i.test(reservationId)) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }
    const r = await (await connectDB()).collection("reservations").findOne({ _id: new ObjectId(reservationId) }, { projection: { roomId: 1 } });
    if (!r || !(await canUseRoom(await connectDB(), auth.access, r.roomId))) return forbiddenRoom();
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
