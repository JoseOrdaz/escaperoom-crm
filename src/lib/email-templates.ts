/**
 * Plantillas editables de los correos de reserva (cliente y servidor, sin dependencias).
 *
 * Cada escape (fobia / action) tiene 4 plantillas. El texto es plano con:
 *   - variables {{nombre}} {{sala}} {{fecha}} {{hora}} {{jugadores}} {{precio}} {{escape}}
 *   - líneas que empiezan por "## " → subtítulo
 *   - URLs → enlaces automáticamente
 *   - línea en blanco → nuevo párrafo
 */
import { VENUES } from "@/lib/venues";

export type Brand = "fobia" | "action";
export type TemplateKey = "created" | "confirmed" | "updated" | "cancelled";

export type EmailTemplate = {
  subject: string;
  heading: string;
  intro: string;
  body: string;
  showDetails: boolean;
  showCancelLink: boolean;
};

export const TEMPLATE_META: Record<TemplateKey, { label: string; when: string }> = {
  created: { label: "Reserva recibida", when: "Automático al crear la reserva (web o CRM)" },
  confirmed: { label: "Reserva confirmada", when: "Al avisar al cliente con la reserva en estado Confirmada" },
  updated: { label: "Datos actualizados", when: "Al avisar al cliente con la reserva en estado Pendiente" },
  cancelled: { label: "Reserva cancelada", when: "Automático si el cliente cancela, o al avisar con estado Cancelada" },
};
export const TEMPLATE_KEYS = Object.keys(TEMPLATE_META) as TemplateKey[];
export const TEMPLATE_VARIABLES = ["nombre", "sala", "fecha", "hora", "jugadores", "precio", "escape"] as const;

const FOBIA_INFO = `Se os ruega llegar 15 minutos antes de la hora reservada para rellenar los documentos necesarios y explicaros las normas, evitando perder tiempo de juego.

## 📍 Nuestra ubicación
Plaza del Portal Nuevo, 8, Ciutat Vella, 46003 Valencia
https://maps.google.com/?q=Plaza+del+Portal+Nuevo,+8,+46003+Valencia

En la zona no es fácil encontrar parking gratuito. Recomendamos venir con tiempo, usar transporte público o aparcar en el Parking La Torreta (a 3 minutos caminando):
https://maps.google.com/?q=Parking+La+Torreta+Valencia

Para esta experiencia recomendamos ropa y calzado cómodo.

## ⚠️ Atención jugadores
Si llegáis 10 minutos tarde, el juego podría acortarse. Si llegáis más de 15 minutos tarde, podríais perder la reserva.

Si necesitas cancelar la reserva, hazlo con al menos 24 horas de antelación.`;

const ACTION_INFO = `Se os ruega llegar 15 minutos antes de la hora reservada para rellenar los documentos necesarios, explicaros las normas y evitar perder tiempo de juego.

## 📍 Nuestra ubicación
C/ dels Centelles, 58, L'Eixample, 46006 València
https://maps.google.com/?q=Carrer+dels+Centelles+58,+Valencia

Recomendamos venir con tiempo o usar transporte público. Hay múltiples aparcamientos de pago cercanos.

Para esta experiencia recomendamos ropa y calzado cómodo.

## ⚠️ Atención jugadores
Si llegáis 10 minutos tarde, el juego podría acortarse. Si llegáis más de 15 minutos tarde, podríais perder la reserva.

Si necesitas cancelar la reserva, hazlo con al menos 24 horas de antelación.`;

function defaultsFor(info: string, emojiCreated: string): Record<TemplateKey, EmailTemplate> {
  return {
    created: {
      subject: `${emojiCreated} Tu reserva en {{escape}} – {{sala}}`,
      heading: "¡Hola, {{nombre}}!",
      intro: "Tu reserva en {{escape}} está confirmada:",
      body: info,
      showDetails: true,
      showCancelLink: true,
    },
    confirmed: {
      subject: "✅ Tu reserva en {{escape}} – {{sala}}",
      heading: "¡Hola, {{nombre}}!",
      intro: "Tu reserva en {{escape}} está confirmada:",
      body: info,
      showDetails: true,
      showCancelLink: true,
    },
    updated: {
      subject: "🔄 Tu reserva en {{escape}} – {{sala}}",
      heading: "¡Hola, {{nombre}}!",
      intro: "Estos son los datos actualizados de tu reserva en {{escape}}:",
      body: info,
      showDetails: true,
      showCancelLink: true,
    },
    cancelled: {
      subject: "❌ Tu reserva en {{escape}} ha sido cancelada",
      heading: "Reserva cancelada",
      intro: "Hola {{nombre}}, tu reserva en {{escape}} ha sido cancelada.",
      body: "Esperamos verte pronto para vivir otra aventura.",
      showDetails: true,
      showCancelLink: false,
    },
  };
}

export const DEFAULT_TEMPLATES: Record<Brand, Record<TemplateKey, EmailTemplate>> = {
  fobia: defaultsFor(FOBIA_INFO, "🔐"),
  action: defaultsFor(ACTION_INFO, "🎯"),
};

/* ───────── Render ───────── */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARIABLES)[number], string>>;

export const fillVars = (text: string, vars: TemplateVars) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? String(vars[k as keyof TemplateVars] ?? "") : m));

/** Texto plano → HTML seguro (párrafos, subtítulos "## ", enlaces) */
export function textToHtml(text: string, accent: string) {
  const link = (line: string) =>
    esc(line).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:${accent};">${u.includes("maps.google") ? "Abrir en Google Maps" : u}</a>`);
  const out: string[] = [];
  for (const block of text.trim().split(/\n{2,}/)) {
    let para: string[] = [];
    const flush = () => {
      if (para.length) out.push(`<p style="margin:0 0 12px;">${para.join("<br/>")}</p>`);
      para = [];
    };
    for (const line of block.split("\n")) {
      if (line.startsWith("## ")) {
        flush();
        out.push(`<h3 style="margin:24px 0 8px;">${link(line.slice(3))}</h3>`);
      } else if (line.trim()) para.push(link(line));
    }
    flush();
  }
  return out.join("");
}

export type ReservationData = {
  reservationId: string;
  roomName: string;
  customerName?: string;
  start: Date;
  end: Date;
  players: number;
  price: number;
  coupon?: { code: string } | null;
};

const p2 = (n: number) => String(n).padStart(2, "0");
/** Las horas se guardan como "hora de pared" en UTC */
export function varsFor(d: ReservationData, brand: Brand): TemplateVars {
  return {
    nombre: d.customerName?.trim().split(/\s+/)[0] || "jugador/a",
    sala: d.roomName,
    fecha: `${p2(d.start.getUTCDate())}/${p2(d.start.getUTCMonth() + 1)}/${d.start.getUTCFullYear()}`,
    hora: `${p2(d.start.getUTCHours())}:${p2(d.start.getUTCMinutes())}`,
    jugadores: String(d.players),
    precio: `${d.price.toFixed(2)} €`,
    escape: VENUES[brand].brand,
  };
}

/** Correo final a partir de una plantilla + datos de la reserva (+ mensaje opcional del equipo) */
export function renderTemplateEmail(opts: {
  brand: Brand;
  key: TemplateKey;
  template: EmailTemplate;
  data: ReservationData;
  message?: string;
  appUrl?: string;
}) {
  const v = VENUES[opts.brand];
  const vars = varsFor(opts.data, opts.brand);
  const t = opts.template;
  const cancelled = opts.key === "cancelled";
  const gradient = cancelled
    ? opts.brand === "fobia" ? "linear-gradient(135deg,#e53935,#b71c1c)" : "linear-gradient(135deg,#00796b,#004d40)"
    : v.gradient;
  const d = opts.data;
  const p = vars;

  const details = t.showDetails
    ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;"><strong>${v.roomLabel}:</strong></td><td>${esc(d.roomName)}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Nº de jugadores:</strong></td><td>${d.players} jugadores</td></tr>
        <tr><td style="padding:4px 0;"><strong>Fecha y hora:</strong></td><td>${p.fecha} – ${p.hora} a ${p2(d.end.getUTCHours())}:${p2(d.end.getUTCMinutes())}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Precio:</strong></td><td>${d.coupon ? `<strong>${p.precio}</strong> <small style="color:#388e3c;">(cupón ${esc(d.coupon.code)})</small>` : p.precio}</td></tr>
      </table>`
    : "";
  const message = opts.message?.trim()
    ? `<div style="margin:20px 0;padding:16px 18px;border-left:4px solid ${v.accent};background:#f6f8fa;border-radius:6px;">
        <p style="margin:0 0 6px;font-size:13px;color:#666;">Mensaje del equipo</p>
        <p style="margin:0;white-space:pre-line;">${esc(opts.message.trim())}</p>
      </div>`
    : "";
  const cancelLink = t.showCancelLink && !cancelled
    ? `<p style="margin-top:16px;"><a href="${opts.appUrl ?? "https://escaperoom-crm.vercel.app"}/api/reservations/${d.reservationId}/cancel" style="display:inline-block;background:${v.accent};color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Cancelar mi reserva</a></p>`
    : "";

  const html = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;background-color:#f6f8fa;padding:30px;">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1)">
      <div style="background:${gradient};color:white;padding:24px;">
        <h1 style="margin:0;font-size:22px;">${esc(fillVars(t.heading, vars))}</h1>
      </div>
      <div style="padding:28px;color:#333;line-height:1.55;">
        <p>${esc(fillVars(t.intro, vars))}</p>
        ${details}
        ${message}
        ${textToHtml(fillVars(t.body, vars), v.accent)}
        ${cancelLink}
        <p style="margin-top:24px;">Un saludo,<br/><strong>${v.team}</strong></p>
        <hr style="margin:30px 0;border:none;border-top:1px solid #ddd;" />
        <p style="font-size:13px;color:#555;">${v.contact}</p>
      </div>
    </div>
  </div>`;
  return { from: v.from, subject: fillVars(t.subject, vars), html };
}
