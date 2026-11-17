import { ObjectId, type Db } from "mongodb";
import { sendLoggedEmail, type EmailEvent, type EmailTrigger } from "@/lib/email-log";
import { VENUES, isFobiaRoom } from "@/lib/venues";
import { DEFAULT_TEMPLATES, renderTemplateEmail, type Brand, type EmailTemplate, type TemplateKey } from "@/lib/email-templates";

export { VENUES, isFobiaRoom };

const APP_URL = "https://escaperoom-crm.vercel.app";
const BCC = "joseordazsuay@gmail.com";


const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n: number) => String(n).padStart(2, "0");
/** Las horas se guardan como "hora de pared" en UTC: usar getters UTC */
const hhmm = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
const ddmmyyyy = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;



export type ReservationEmailKind = "status" | "manual";

type BuildInput = {
  kind: ReservationEmailKind;
  reservationId: string;
  roomName: string;
  customerName?: string;
  start: Date;
  end: Date;
  players: number;
  price: number;
  coupon?: { code: string; type: "percent" | "amount"; value: number } | null;
  status: "pendiente" | "confirmada" | "cancelada";
  message?: string;
  subject?: string;
  includeDetails?: boolean;
};

export function buildReservationEmail(i: BuildInput) {
  const v = isFobiaRoom(i.roomName) ? VENUES.fobia : VENUES.action;
  const first = esc(i.customerName?.trim().split(/\s+/)[0] || "jugador/a");
  const cancelled = i.status === "cancelada";
  const message = i.message?.trim();

  const priceHtml = i.coupon
    ? `<strong>${i.price.toFixed(2)} €</strong> <small style="color:#388e3c;">(cupón ${esc(i.coupon.code)})</small>`
    : `${i.price.toFixed(2)} €`;

  const details = `
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:4px 0;"><strong>${v.roomLabel}:</strong></td><td>${esc(i.roomName)}</td></tr>
          <tr><td style="padding:4px 0;"><strong>Nº de jugadores:</strong></td><td>${i.players} jugadores</td></tr>
          <tr><td style="padding:4px 0;"><strong>Fecha y hora:</strong></td><td>${ddmmyyyy(i.start)} – ${hhmm(i.start)} a ${hhmm(i.end)}</td></tr>
          <tr><td style="padding:4px 0;"><strong>Precio:</strong></td><td>${priceHtml}</td></tr>
        </table>`;

  const messageBox = message
    ? `
        <div style="margin:20px 0;padding:16px 18px;border-left:4px solid ${v.accent};background:#f6f8fa;border-radius:6px;">
          <p style="margin:0 0 6px;font-size:13px;color:#666;">Mensaje del equipo</p>
          <p style="margin:0;white-space:pre-line;">${esc(message)}</p>
        </div>`
    : "";

  let title: string;
  let intro: string;
  let subject: string;
  let gradient: string = v.gradient;
  let extras = "";

  if (i.kind === "manual") {
    title = `¡Hola, ${first}!`;
    intro = `Te escribimos sobre tu reserva en <strong>${v.brand}</strong>.`;
    subject = i.subject?.trim() || `Sobre tu reserva en ${v.brand} – ${i.roomName}`;
  } else if (cancelled) {
    title = "Reserva cancelada";
    intro = `Hola ${first},<br/>Tu reserva en <strong>${v.brand}</strong> ha sido cancelada.`;
    subject = `❌ Tu reserva en ${v.brand} ha sido cancelada`;
    gradient = isFobiaRoom(i.roomName) ? "linear-gradient(135deg,#e53935,#b71c1c)" : "linear-gradient(135deg,#00796b,#004d40)";
  } else {
    title = `¡Hola, ${first}!`;
    intro =
      i.status === "confirmada"
        ? `Tu reserva en <strong>${v.brand}</strong> está confirmada:`
        : `Estos son los datos actualizados de tu reserva en <strong>${v.brand}</strong>:`;
    subject = `${i.status === "confirmada" ? "✅" : "🔄"} Tu reserva en ${v.brand} – ${i.roomName}`;
    extras = `
        <p>Se os ruega llegar 15 minutos antes de la hora reservada para rellenar documentos necesarios, explicaros las normas y evitar perder tiempo de juego.</p>
        ${v.info}
        <h3 style="margin-top:24px;">⚠️ Atención jugadores</h3>
        <p>Si llegáis 10 minutos tarde, el juego podría acortarse. Si llegáis más de 15 minutos tarde, podríais perder la reserva.</p>
        <p>Si necesitas cancelar la reserva, hazlo con al menos 24 horas de antelación:</p>
        <a href="${APP_URL}/api/reservations/${i.reservationId}/cancel" style="display:inline-block;background:${v.accent};color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Cancelar mi reserva</a>`;
  }

  const showDetails = i.kind === "status" || i.includeDetails !== false;

  const html = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;background-color:#f6f8fa;padding:30px;">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1)">
      <div style="background:${gradient};color:white;padding:24px;">
        <h1 style="margin:0;font-size:22px;">${title}</h1>
      </div>
      <div style="padding:28px;color:#333;">
        <p>${intro}</p>
        ${i.kind === "manual" ? messageBox : ""}
        ${showDetails ? details : ""}
        ${i.kind === "status" ? messageBox : ""}
        ${extras}
        <p style="margin-top:24px;">${cancelled && i.kind === "status" ? "Esperamos verte pronto para vivir otra aventura." : `Un saludo,<br/><strong>${v.team}</strong>`}</p>
        <hr style="margin:30px 0;border:none;border-top:1px solid #ddd;" />
        <p style="font-size:13px;color:#555;">${v.contact}</p>
      </div>
    </div>
  </div>`;

  return { from: v.from, subject, html };
}

/** Plantilla guardada (colección `email_templates`) o la de por defecto */
export async function loadTemplate(db: Db, brand: Brand, key: TemplateKey): Promise<EmailTemplate> {
  const doc = await db.collection<{ _id: string } & Partial<EmailTemplate>>("email_templates").findOne({ _id: `${brand}:${key}` });
  const base = DEFAULT_TEMPLATES[brand][key];
  return {
    subject: doc?.subject ?? base.subject,
    heading: doc?.heading ?? base.heading,
    intro: doc?.intro ?? base.intro,
    body: doc?.body ?? base.body,
    showDetails: doc?.showDetails ?? base.showDetails,
    showCancelLink: doc?.showCancelLink ?? base.showCancelLink,
  };
}

/**
 * Carga la reserva (sala, cliente) de la base de datos, construye el correo,
 * lo envía y lo registra en `email_logs`.
 */
export async function sendReservationEmail(
  db: Db,
  opts: {
    reservationId: ObjectId;
    kind: ReservationEmailKind;
    trigger: EmailTrigger;
    event: EmailEvent;
    message?: string;
    subject?: string;
    includeDetails?: boolean;
    sentBy?: { id: string; name: string } | null;
    /** Plantilla a usar (por defecto según el evento/estado) */
    template?: TemplateKey;
  }
) {
  const r = await db.collection("reservations").findOne({ _id: opts.reservationId });
  if (!r) return { ok: false as const, error: "Reserva no encontrada" };
  const customer = r.customerId ? await db.collection("customers").findOne({ _id: r.customerId }) : null;
  if (!customer?.email) return { ok: false as const, error: "La reserva no tiene un cliente con email" };
  const room = await db.collection("rooms").findOne({ _id: r.roomId });
  const roomName = room?.name ?? r.roomName ?? "Sala";

  // Correos de estado → plantilla editable (Ajustes → Plantillas de correo)
  if (opts.kind === "status") {
    const brand: Brand = isFobiaRoom(roomName) ? "fobia" : "action";
    const key: TemplateKey =
      opts.template ??
      (opts.event === "created" ? "created" : r.status === "cancelada" ? "cancelled" : r.status === "confirmada" ? "confirmed" : "updated");
    const tmail = renderTemplateEmail({
      brand,
      key,
      template: await loadTemplate(db, brand, key),
      data: {
        reservationId: String(r._id), roomName, customerName: customer.name, start: new Date(r.start), end: new Date(r.end),
        players: Number(r.players ?? 0), price: Number(r.price ?? 0), coupon: r.coupon ?? null,
      },
      message: opts.message,
      appUrl: APP_URL,
    });
    return sendLoggedEmail(
      db,
      { trigger: opts.trigger, event: opts.event, reservationId: r._id, customerId: r.customerId, roomName, reservationStart: r.start, sentBy: opts.sentBy, message: opts.message },
      { from: tmail.from, to: customer.email, bcc: BCC, subject: tmail.subject, html: tmail.html }
    );
  }

  const mail = buildReservationEmail({
    kind: opts.kind,
    reservationId: String(r._id),
    roomName,
    customerName: customer.name,
    start: new Date(r.start),
    end: new Date(r.end),
    players: Number(r.players ?? 0),
    price: Number(r.price ?? 0),
    coupon: r.coupon ?? null,
    status: r.status ?? "pendiente",
    message: opts.message,
    subject: opts.subject,
    includeDetails: opts.includeDetails,
  });

  return sendLoggedEmail(
    db,
    {
      trigger: opts.trigger,
      event: opts.event,
      reservationId: r._id,
      customerId: r.customerId,
      roomName,
      reservationStart: r.start,
      sentBy: opts.sentBy,
      message: opts.message,
    },
    { from: mail.from, to: customer.email, bcc: BCC, subject: mail.subject, html: mail.html }
  );
}
