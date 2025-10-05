// src/app/api/reservations/search/route.ts
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";

function parseIntOr<T extends number>(v: any, def: T): number {
  const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page     = parseIntOr(searchParams.get("page"), 1);
    const pageSize = parseIntOr(searchParams.get("pageSize"), 20);

    const from = searchParams.get("from") ?? "";
    const to   = searchParams.get("to") ?? "";
    const roomId = searchParams.get("roomId") ?? "";
    const lang = searchParams.get("language") ?? "";
    const q = (searchParams.get("q") ?? "").trim();
    const players = searchParams.get("players") ? Number(searchParams.get("players")) : undefined;

    const db = await connectDB();
    const filter: any = {};

    if (YMD.test(from) && YMD.test(to)) {
      const fromD = new Date(`${from}T00:00:00`);
      const toD   = new Date(`${to}T00:00:00`);
      filter.start = { $gte: fromD };
      filter.end   = { $lt: toD };
    }
    if (roomId) filter.roomId = new ObjectId(roomId);
    if (lang) filter.language = lang;
    if (Number.isInteger(players)) filter.players = players;
    if (q) {
  // Buscar también por clientes
  const custMatches = await db.collection("customers")
    .find({
      $or: [
        { name:  { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ],
    }, { projection: { _id:1 } })
    .toArray();
  const custIds = custMatches.map(c => c._id);

  filter.$or = [
    { notes:       { $regex: q, $options: "i" } },
    // { description: { $regex: q, $options: "i" } },
    { roomName:    { $regex: q, $options: "i" } },
    ...(custIds.length ? [{ customerId: { $in: custIds } }] : []),
  ];
}


    const total = await db.collection("reservations").countDocuments(filter);
    const items = await db.collection("reservations")
      .find(filter)
      .sort({ start: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();

    const out = items.map((d: any) => ({
      _id: String(d._id),
      roomId: String(d.roomId),
      roomName: d.roomName,
      start: d.start.toISOString(),
      end: d.end.toISOString(),
      players: d.players,
      price: d.price ?? 0,
      language: d.language ?? "es",
      customer: d.customer ?? { name: "", email: "" },
      extraInfo: d.notes ?? "",
      // description: d.description ?? "",
    }));

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ ok:false, error: err?.message ?? "Error" }, { status:500 });
  }
}
