import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAccess } from "@/lib/access";
import { ESCAPES, escapeOfRoom, type Escape } from "@/lib/permissions";

/* GET → listado de clientes con número de reservas
   Sin parámetros: todos (para los selectores del formulario de reservas).
   Con ?page=: modo listado paginado para la página Clientes
     ?escape=all|fobia|action  ?sort=recent|reservations|lastVisit|name  ?q=texto  ?page=1&pageSize=25 */
export async function GET(req: Request) {
  const auth = await requireAccess(null);
  if (auth.response) return auth.response;
  try {
    const db = await connectDB();
    const sp = new URL(req.url).searchParams;
    const paged = sp.has("page");

    const customers = await db
      .collection("customers")
      .find({}, { projection: { name: 1, email: 1, phone: 1, createdAt: 1 } })
      .sort({ name: 1 })
      .toArray();

    const stats = await db
      .collection("reservations")
      .aggregate([
        { $match: { customerId: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$customerId",
            count: { $sum: 1 },
            active: { $sum: { $cond: [{ $ne: ["$status", "cancelada"] }, 1, 0] } },
            rooms: { $addToSet: "$roomId" },
            last: { $max: "$start" },
          },
        },
      ])
      .toArray();
    const statMap = new Map(stats.map((c) => [String(c._id), c]));

    if (!paged) {
      return NextResponse.json({
        items: customers.map((c) => ({
          _id: String(c._id),
          name: c.name ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          reservationsCount: statMap.get(String(c._id))?.count ?? 0,
        })),
      });
    }

    // ── Modo listado ──
    const rooms = await db.collection("rooms").find({}, { projection: { name: 1, escape: 1 } }).toArray();
    const roomEscape = new Map(rooms.map((r) => [String(r._id), escapeOfRoom(r)]));
    const fullAccess = ESCAPES.every((e) => auth.access.escapes.includes(e));

    let rows = customers.map((c) => {
      const st = statMap.get(String(c._id));
      const escapes = [...new Set((st?.rooms ?? []).map((id: unknown) => roomEscape.get(String(id))).filter(Boolean))] as Escape[];
      return {
        _id: String(c._id),
        name: c.name ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
        reservationsCount: st?.count ?? 0,
        activeReservations: st?.active ?? 0,
        lastReservation: st?.last ? new Date(st.last).toISOString() : null,
        escapes,
      };
    });
    // Admin de un solo escape: solo clientes que han reservado en su escape
    if (!fullAccess) rows = rows.filter((r) => r.escapes.some((e) => auth.access.escapes.includes(e)));

    const counts = {
      all: rows.length,
      fobia: rows.filter((r) => r.escapes.includes("Fobia")).length,
      action: rows.filter((r) => r.escapes.includes("Action Gates")).length,
    };

    const escape = sp.get("escape");
    if (escape === "fobia") rows = rows.filter((r) => r.escapes.includes("Fobia"));
    if (escape === "action") rows = rows.filter((r) => r.escapes.includes("Action Gates"));

    const q = (sp.get("q") ?? "").trim().toLowerCase();
    if (q) {
      const qDigits = q.replace(/\D/g, "");
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (qDigits.length >= 3 && r.phone.replace(/\D/g, "").includes(qDigits))
      );
    }

    const time = (d: string | null) => (d ? new Date(d).getTime() : 0);
    const sort = sp.get("sort") ?? "recent";
    rows.sort((a, b) =>
      sort === "reservations" ? b.activeReservations - a.activeReservations || time(b.lastReservation) - time(a.lastReservation)
      : sort === "lastVisit" ? time(b.lastReservation) - time(a.lastReservation)
      : sort === "name" ? a.name.localeCompare(b.name, "es")
      : time(b.createdAt) - time(a.createdAt) || a.name.localeCompare(b.name, "es")
    );

    const pageSize = Math.min(100, Math.max(5, Number(sp.get("pageSize")) || 25));
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(pages, Math.max(1, Number(sp.get("page")) || 1));
    return NextResponse.json({
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pages,
      pageSize,
      counts,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

/* POST → crear nuevo cliente */
export async function POST(req: Request) {
  const auth = await requireAccess(req, "reservations.create");
  if (auth.response) return auth.response;
  try {
    const db = await connectDB();
    const body = await req.json();

    if (!body.name || !body.email) {
      return NextResponse.json(
        { ok: false, error: "Nombre y email son obligatorios" },
        { status: 400 }
      );
    }

    const res = await db.collection("customers").insertOne({
      name: body.name,
      email: body.email.toLowerCase().trim(),
      phone: body.phone ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, _id: String(res.insertedId) });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
