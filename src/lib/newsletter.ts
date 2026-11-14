import { createHash, createHmac, timingSafeEqual } from "crypto";
import { ObjectId, type Db } from "mongodb";
import { isFobiaRoom } from "@/lib/venues";
import { buildNewsletterEmail } from "@/lib/newsletter-template";

export { buildNewsletterEmail };

const APP_URL = "https://escaperoom-crm.vercel.app";

import type { Brand } from "@/lib/newsletter-template";
export type { Brand };
export type Audience =
  | { type: "all" }
  | { type: "fobia" }
  | { type: "action" }
  | { type: "selected"; ids: string[] };

/* ───────── Baja (unsubscribe) firmada ───────── */
function secret() {
  // UNSUBSCRIBE_SECRET recomendado; si falta, se deriva de la conexión a la BD (no se expone)
  return process.env.UNSUBSCRIBE_SECRET || createHash("sha256").update(`unsub:${process.env.MONGODB_URI ?? ""}`).digest("hex");
}
export const unsubscribeToken = (customerId: string) =>
  createHmac("sha256", secret()).update(customerId).digest("hex").slice(0, 32);

export function verifyUnsubscribe(customerId: string, token: string) {
  const expected = Buffer.from(unsubscribeToken(customerId));
  const given = Buffer.from(String(token));
  return expected.length === given.length && timingSafeEqual(expected, given);
}
export const unsubscribeUrl = (customerId: string) =>
  `${APP_URL}/api/newsletter/unsubscribe?c=${customerId}&t=${unsubscribeToken(customerId)}`;

/* ───────── Destinatarios ───────── */
export type Recipient = {
  _id: string;
  name: string;
  email: string;
  venues: Brand[];
  reservations: number;
  lastVisit: string | null;
  optedOut: boolean;
};

export async function listRecipients(db: Db): Promise<Recipient[]> {
  const [customers, stats, rooms] = await Promise.all([
    db
      .collection("customers")
      .find({ email: { $regex: "@" } }, { projection: { name: 1, email: 1, newsletterOptOut: 1 } })
      .toArray(),
    db
      .collection("reservations")
      .aggregate([
        { $match: { customerId: { $ne: null } } },
        { $group: { _id: "$customerId", rooms: { $addToSet: "$roomId" }, count: { $sum: 1 }, last: { $max: "$start" } } },
      ])
      .toArray(),
    db.collection("rooms").find({}, { projection: { name: 1 } }).toArray(),
  ]);
  const roomBrand = new Map(rooms.map((r) => [String(r._id), (isFobiaRoom(r.name) ? "fobia" : "action") as Brand]));
  const byCustomer = new Map(stats.map((s) => [String(s._id), s]));

  return customers
    .map((c) => {
      const s = byCustomer.get(String(c._id));
      const venues = [...new Set((s?.rooms ?? []).map((id: ObjectId) => roomBrand.get(String(id))).filter(Boolean))] as Brand[];
      return {
        _id: String(c._id),
        name: c.name ?? "",
        email: String(c.email).toLowerCase(),
        venues,
        reservations: s?.count ?? 0,
        lastVisit: s?.last ? new Date(s.last).toISOString() : null,
        optedOut: !!c.newsletterOptOut,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Resuelve la audiencia en destinatarios únicos por email, sin bajas */
export function pickAudience(all: Recipient[], audience: Audience, allowedBrands: Brand[] = ["fobia", "action"]) {
  // Admin de un solo escape: solo clientes que han reservado en ese escape
  const fullAccess = allowedBrands.includes("fobia") && allowedBrands.includes("action");
  all = fullAccess ? all : all.filter((r) => r.venues.some((v) => allowedBrands.includes(v)));
  const chosen =
    audience.type === "selected"
      ? all.filter((r) => audience.ids.includes(r._id))
      : audience.type === "all"
        ? all
        : all.filter((r) => r.venues.includes(audience.type));
  // Si cualquier ficha con ese email se dio de baja, no se envía a ese email
  const optedOutEmails = new Set(all.filter((r) => r.optedOut).map((r) => r.email));
  const seen = new Set<string>();
  return chosen.filter((r) => {
    if (optedOutEmails.has(r.email) || seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });
}
