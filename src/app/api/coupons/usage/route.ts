import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAccess, scopedRoomIds } from "@/lib/access";

/* GET → uso de cada cupón por sala (reservas de mis escapes que lo llevan) */
export async function GET() {
  const auth = await requireAccess(null, "coupons.manage");
  if (auth.response) return auth.response;
  const db = await connectDB();
  const roomIds = await scopedRoomIds(db, auth.access);

  const [rows, rooms] = await Promise.all([
    db.collection("reservations").aggregate([
      { $match: { roomId: { $in: roomIds }, "coupon.code": { $exists: true, $nin: [null, ""] } } },
      {
        $group: {
          _id: { code: { $toUpper: "$coupon.code" }, roomId: "$roomId" },
          uses: { $sum: { $cond: [{ $ne: ["$status", "cancelada"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelada"] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $ne: ["$status", "cancelada"] }, "$price", 0] } },
          last: { $max: "$start" },
        },
      },
    ]).toArray(),
    db.collection("rooms").find({ _id: { $in: roomIds } }, { projection: { name: 1 } }).toArray(),
  ]);
  const roomName = new Map(rooms.map((r) => [String(r._id), r.name as string]));

  const usage: Record<string, { rooms: { roomId: string; name: string; uses: number; cancelled: number; revenue: number }[]; uses: number; revenue: number; last: string | null }> = {};
  for (const r of rows) {
    const u = (usage[r._id.code] ??= { rooms: [], uses: 0, revenue: 0, last: null });
    u.rooms.push({ roomId: String(r._id.roomId), name: roomName.get(String(r._id.roomId)) ?? "Sala", uses: r.uses, cancelled: r.cancelled, revenue: r.revenue });
    u.uses += r.uses;
    u.revenue += r.revenue;
    const last = r.last ? new Date(r.last).toISOString() : null;
    if (last && (!u.last || last > u.last)) u.last = last;
  }
  Object.values(usage).forEach((u) => u.rooms.sort((a, b) => b.uses - a.uses));
  return NextResponse.json({ ok: true, usage });
}
