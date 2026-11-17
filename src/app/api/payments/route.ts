import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { requireAccess, scopedRooms } from "@/lib/access";
import { escapeOfRoom } from "@/lib/permissions";
import { outstanding, paymentOf, type PaymentMethod } from "@/lib/payments";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /api/payments?from=YYYY-MM-DD&to=YYYY-MM-DD&escape=&roomId=
 * Reservas (no canceladas) del periodo con su estado de cobro + estadísticas.
 */
export async function GET(req: Request) {
  const auth = await requireAccess(null, "payments.manage");
  if (auth.response) return auth.response;
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!YMD.test(from) || !YMD.test(to)) return NextResponse.json({ ok: false, error: "Periodo inválido" }, { status: 400 });
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  if (end <= start || end.getTime() - start.getTime() > 400 * 86400000) {
    return NextResponse.json({ ok: false, error: "El periodo debe ser de un año como máximo" }, { status: 400 });
  }

  const db = await connectDB();
  const allRooms = await scopedRooms(db, auth.access);
  const escape = url.searchParams.get("escape") ?? "";
  const roomId = url.searchParams.get("roomId") ?? "";
  const rooms = allRooms.filter((r) => (!escape || escapeOfRoom(r) === escape) && (!roomId || String(r._id) === roomId));
  const roomById = new Map(allRooms.map((r) => [String(r._id), r]));

  const docs = await db
    .collection("reservations")
    .aggregate([
      { $match: { roomId: { $in: rooms.map((r) => r._id as ObjectId) }, status: { $ne: "cancelada" }, start: { $gte: start, $lt: end } } },
      { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "c" } },
      {
        $project: {
          roomId: 1, roomName: 1, start: 1, end: 1, players: 1, price: 1, status: 1, coupon: 1, payment: 1, legacy: 1, priceManual: 1,
          customer: { $arrayElemAt: ["$c", 0] },
        },
      },
      { $sort: { start: -1 } },
    ])
    .toArray();

  const now = new Date();
  // "Ahora" en hora de pared guardada como UTC (Europa/Madrid)
  const wall = new Date(now.toLocaleString("sv-SE", { timeZone: "Europe/Madrid" }).replace(" ", "T") + "Z");

  const rows = docs.map((d) => {
    const price = round2(Number(d.price ?? 0));
    const payment = paymentOf({ price, payment: d.payment, legacy: d.legacy });
    const room = roomById.get(String(d.roomId));
    return {
      _id: String(d._id),
      roomId: String(d.roomId),
      roomName: d.roomName ?? room?.name ?? "Sala",
      escape: escapeOfRoom(room),
      start: d.start,
      end: d.end,
      played: new Date(d.end ?? d.start) <= wall,
      players: d.players ?? 0,
      status: d.status ?? "pendiente",
      price,
      coupon: d.coupon?.code ?? null,
      payment,
      due: outstanding(price, payment),
      customer: d.customer
        ? { _id: String(d.customer._id), name: d.customer.name ?? "", email: d.customer.email ?? "", phone: d.customer.phone ?? "" }
        : null,
    };
  });

  // Estadísticas
  const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));
  const billed = sum(rows.map((r) => r.price));
  const collected = sum(rows.map((r) => r.payment.paidAmount));
  const pending = sum(rows.map((r) => r.due));
  const overdue = sum(rows.filter((r) => r.played).map((r) => r.due));
  const byMethod = new Map<PaymentMethod | "sin-metodo", { amount: number; count: number }>();
  const byRoom = new Map<string, { name: string; billed: number; collected: number; count: number }>();
  const byDay = new Map<string, { billed: number; collected: number; count: number }>();
  const customers = new Map<string, { _id: string; name: string; email: string; count: number; spent: number }>();
  for (const r of rows) {
    if (r.payment.paidAmount > 0) {
      const k = r.payment.method ?? "sin-metodo";
      const m = byMethod.get(k) ?? { amount: 0, count: 0 };
      byMethod.set(k, { amount: m.amount + r.payment.paidAmount, count: m.count + 1 });
    }
    const br = byRoom.get(r.roomId) ?? { name: r.roomName, billed: 0, collected: 0, count: 0 };
    byRoom.set(r.roomId, { ...br, billed: br.billed + r.price, collected: br.collected + r.payment.paidAmount, count: br.count + 1 });
    const day = new Date(r.start).toISOString().slice(0, 10);
    const bd = byDay.get(day) ?? { billed: 0, collected: 0, count: 0 };
    byDay.set(day, { billed: bd.billed + r.price, collected: bd.collected + r.payment.paidAmount, count: bd.count + 1 });
    if (r.customer) {
      const c = customers.get(r.customer._id) ?? { _id: r.customer._id, name: r.customer.name, email: r.customer.email, count: 0, spent: 0 };
      customers.set(r.customer._id, { ...c, count: c.count + 1, spent: c.spent + r.price });
    }
  }

  const days: { day: string; billed: number; collected: number; count: number }[] = [];
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    const v = byDay.get(k) ?? { billed: 0, collected: 0, count: 0 };
    days.push({ day: k, billed: round2(v.billed), collected: round2(v.collected), count: v.count });
  }

  return NextResponse.json({
    ok: true,
    rooms: allRooms.map((r) => ({ _id: String(r._id), name: r.name, escape: escapeOfRoom(r) })),
    stats: {
      count: rows.length,
      players: rows.reduce((n, r) => n + r.players, 0),
      billed,
      collected,
      pending,
      overdue,
      avgTicket: rows.length ? round2(billed / rows.length) : 0,
      paidCount: rows.filter((r) => r.payment.status === "pagado").length,
      coupons: rows.filter((r) => r.coupon).length,
      byMethod: [...byMethod].map(([method, v]) => ({ method, amount: round2(v.amount), count: v.count })).sort((a, b) => b.amount - a.amount),
      byRoom: [...byRoom.values()].map((v) => ({ ...v, billed: round2(v.billed), collected: round2(v.collected) })).sort((a, b) => b.billed - a.billed),
      topCustomers: [...customers.values()].map((c) => ({ ...c, spent: round2(c.spent) })).sort((a, b) => b.spent - a.spent).slice(0, 5),
      days,
    },
    rows,
  });
}
