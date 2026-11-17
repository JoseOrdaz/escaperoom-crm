import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { requireAccess, scopedRooms } from "@/lib/access";
import { escapeOfRoom } from "@/lib/permissions";

/**
 * GET /api/ranking?roomId=&period=all|year|month
 * Reservas con resultado (equipo / puntuación / tiempo) de mis escapes,
 * ordenadas por puntuación (desc) y, a igualdad, por tiempo (asc).
 */
export async function GET(req: Request) {
  const auth = await requireAccess(null, "reservations.view");
  if (auth.response) return auth.response;
  const db = await connectDB();
  const url = new URL(req.url);

  const rooms = await scopedRooms(db, auth.access);
  const roomParam = url.searchParams.get("roomId") ?? "";
  const roomIds = /^[a-f0-9]{24}$/i.test(roomParam)
    ? rooms.filter((r) => String(r._id) === roomParam).map((r) => r._id as ObjectId)
    : rooms.map((r) => r._id as ObjectId);

  const period = url.searchParams.get("period") ?? "all";
  const now = new Date();
  const since =
    period === "month" ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    : period === "year" ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    : null;

  const docs = await db
    .collection("reservations")
    .aggregate([
      {
        $match: {
          roomId: { $in: roomIds },
          status: { $ne: "cancelada" },
          ranking: { $type: "object" },
          ...(since ? { start: { $gte: since } } : {}),
        },
      },
      { $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "c" } },
      {
        $project: {
          roomId: 1, roomName: 1, start: 1, players: 1, ranking: 1,
          customerName: { $ifNull: [{ $arrayElemAt: ["$c.name", 0] }, ""] },
        },
      },
      { $sort: { "ranking.score": -1, "ranking.timeSeconds": 1, start: -1 } },
      { $limit: 500 },
    ])
    .toArray();

  const roomById = new Map(rooms.map((r) => [String(r._id), r]));
  // Sin puntuación al final; a igualdad de puntos gana el menor tiempo (y sin tiempo, detrás)
  const rows = docs
    .map((d) => ({
      _id: String(d._id),
      roomId: String(d.roomId),
      roomName: d.roomName ?? roomById.get(String(d.roomId))?.name ?? "Sala",
      escape: escapeOfRoom(roomById.get(String(d.roomId))),
      start: d.start,
      players: d.players ?? 0,
      customerName: d.customerName,
      teamName: d.ranking?.teamName ?? "",
      score: typeof d.ranking?.score === "number" ? d.ranking.score : null,
      timeSeconds: typeof d.ranking?.timeSeconds === "number" ? d.ranking.timeSeconds : null,
    }))
    .sort((a, b) => {
      if ((a.score === null) !== (b.score === null)) return a.score === null ? 1 : -1;
      if (a.score !== b.score) return (b.score ?? 0) - (a.score ?? 0);
      if ((a.timeSeconds === null) !== (b.timeSeconds === null)) return a.timeSeconds === null ? 1 : -1;
      return (a.timeSeconds ?? 0) - (b.timeSeconds ?? 0);
    });

  return NextResponse.json({
    ok: true,
    rooms: rooms.map((r) => ({ _id: String(r._id), name: r.name, escape: escapeOfRoom(r) })),
    rows,
  });
}
