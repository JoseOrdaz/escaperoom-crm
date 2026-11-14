import { ObjectId, type Db } from "mongodb";
import { createMailer, type MailOptions } from "@/lib/mailer";

export type EmailTrigger = "auto" | "manual";
export type EmailEvent = "created" | "updated" | "cancelled" | "manual";

export type EmailMeta = {
  trigger: EmailTrigger;
  event: EmailEvent;
  reservationId?: ObjectId | string | null;
  customerId?: ObjectId | string | null;
  roomName?: string;
  reservationStart?: Date | string | null;
  sentBy?: { id: string; name: string } | null;
  /** Mensaje escrito a mano (si lo hay), para mostrarlo en el registro */
  message?: string;
};

const toId = (v?: ObjectId | string | null) =>
  v instanceof ObjectId ? v : typeof v === "string" && /^[a-f0-9]{24}$/i.test(v) ? new ObjectId(v) : null;

const addresses = (a: MailOptions["to"]) =>
  (Array.isArray(a) ? a : a ? a.split(",") : []).map((s) => s.trim()).filter(Boolean);

/**
 * Envía un correo y deja constancia en la colección `email_logs`,
 * tanto si sale bien como si falla. Nunca lanza: devuelve { ok, error }.
 */
export async function sendLoggedEmail(db: Db, meta: EmailMeta, mail: MailOptions) {
  const base = {
    trigger: meta.trigger,
    event: meta.event,
    reservationId: toId(meta.reservationId),
    customerId: toId(meta.customerId),
    roomName: meta.roomName ?? null,
    reservationStart: meta.reservationStart ? new Date(meta.reservationStart) : null,
    sentBy: meta.sentBy ?? null,
    message: meta.message?.trim() || null,
    from: mail.from,
    to: addresses(mail.to),
    subject: mail.subject,
    html: mail.html,
    createdAt: new Date(),
  };

  try {
    const result = (await createMailer().sendMail(mail)) as { messageId?: string } | undefined;
    await db.collection("email_logs").insertOne({ ...base, status: "sent", messageId: result?.messageId ?? null });
    return { ok: true as const };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Error enviando correo:", error);
    await db
      .collection("email_logs")
      .insertOne({ ...base, status: "error", error })
      .catch(() => {});
    return { ok: false as const, error };
  }
}
