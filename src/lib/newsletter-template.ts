import { VENUES } from "@/lib/venues";

export type Brand = "fobia" | "action";
/** fields = formulario (texto plano) · html = HTML libre (editor visual o código pegado) */
export type ContentFormat = "fields" | "html";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Limpieza básica del HTML libre: quita scripts, iframes/objetos, manejadores
 * on*= y enlaces javascript:. Los clientes de correo los bloquean igualmente;
 * así además la vista previa y el registro quedan seguros.
 */
export function sanitizeEmailHtml(html: string) {
  return html
    .replace(/<\s*(script|iframe|object|embed|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|form|meta|base)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

/** Sustituye {{nombre}} por el nombre de pila (o lo quita si no hay) */
const personalize = (html: string, first?: string) =>
  html.replace(/\{\{\s*nombre\s*\}\}/gi, first ? esc(first) : "");

export function buildNewsletterEmail(i: {
  brand: Brand;
  subject: string;
  title?: string;
  message?: string;
  ctaText?: string;
  ctaUrl?: string;
  /** Contenido libre (editor visual o HTML pegado) */
  format?: ContentFormat;
  html?: string;
  /** true → el HTML libre va dentro del diseño de la marca; false → se envía tal cual */
  wrap?: boolean;
  recipientName?: string;
  unsubscribeLink?: string;
}) {
  const v = i.brand === "fobia" ? VENUES.fobia : VENUES.action;
  const first = i.recipientName?.trim().split(/\s+/)[0];
  const isHtml = i.format === "html";
  const wrap = !isHtml || i.wrap !== false;

  const unsubscribe = i.unsubscribeLink
    ? `<p style="font-size:12px;color:#888;font-family:'Segoe UI',Tahoma,sans-serif;">Recibes este correo porque has reservado con nosotros. Si no quieres recibir más avisos, <a href="${esc(i.unsubscribeLink)}" style="color:#888;">date de baja aquí</a>.</p>`
    : "";

  // ── HTML libre enviado tal cual (solo se añade el pie de baja) ──
  if (isHtml && !wrap) {
    const body = personalize(sanitizeEmailHtml(i.html ?? ""), first);
    const footer = `<div style="max-width:600px;margin:24px auto 0;padding:0 16px;text-align:center;">${unsubscribe}</div>`;
    const html = /<\/body>/i.test(body) ? body.replace(/<\/body>/i, `${footer}</body>`) : `${body}${footer}`;
    return { from: v.from, subject: i.subject.trim(), html };
  }

  // ── Diseño de la marca ──
  const greeting = first ? `¡Hola, ${esc(first)}!` : "¡Hola!";
  const safeUrl = i.ctaUrl && /^https?:\/\//i.test(i.ctaUrl) ? i.ctaUrl : "";
  const content = isHtml
    ? `<div>${personalize(sanitizeEmailHtml(i.html ?? ""), first)}</div>`
    : `<p>${greeting}</p>
        <p style="white-space:pre-line;">${personalize(esc(i.message ?? ""), first)}</p>
        ${
          safeUrl && i.ctaText?.trim()
            ? `<p style="margin:24px 0;"><a href="${esc(safeUrl)}" style="display:inline-block;background:${v.accent};color:white;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;">${esc(i.ctaText)}</a></p>`
            : ""
        }
        <p style="margin-top:24px;">Un saludo,<br/><strong>${v.team}</strong></p>`;

  const html = `
  <div style="font-family:'Segoe UI',Tahoma,sans-serif;background-color:#f6f8fa;padding:30px;">
    <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.1)">
      <div style="background:${v.gradient};color:white;padding:24px;">
        <p style="margin:0 0 4px;font-size:13px;opacity:.85;">${v.brand}</p>
        <h1 style="margin:0;font-size:22px;">${esc(i.title?.trim() || i.subject)}</h1>
      </div>
      <div style="padding:28px;color:#333;line-height:1.55;">
        ${content}
        <hr style="margin:30px 0;border:none;border-top:1px solid #ddd;" />
        <p style="font-size:13px;color:#555;">${v.contact}</p>
        ${unsubscribe}
      </div>
    </div>
  </div>`;
  return { from: v.from, subject: i.subject.trim(), html };
}
