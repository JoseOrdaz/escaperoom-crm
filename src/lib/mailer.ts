import nodemailer from "nodemailer";

type Address = string | string[] | undefined;
export type MailOptions = {
  from: string;
  to: Address;
  bcc?: Address;
  replyTo?: string;
  subject: string;
  html: string;
};
export type Mailer = { sendMail: (opts: MailOptions) => Promise<unknown> };

/** '"Fobia Escape Room" <valencia@fobiaescape.com>' → { name, email } */
function parseAddress(value: string) {
  const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: value.trim() };
}
const list = (a: Address) =>
  (Array.isArray(a) ? a : a ? a.split(",") : []).map((s) => s.trim()).filter(Boolean).map(parseAddress);

/**
 * Devuelve un objeto con `sendMail` (misma forma que nodemailer).
 *
 * - Si hay una API key de Brevo (`BREVO_API_KEY`, o una clave `xkeysib-…`
 *   puesta en `SMTP_PASS`), envía por la API HTTP de Brevo.
 * - Si no, usa SMTP con `SMTP_HOST/PORT/USER/PASS` (clave `xsmtpsib-…`).
 */
export function createMailer(): Mailer {
  const { BREVO_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const apiKey = BREVO_API_KEY || (SMTP_PASS?.startsWith("xkeysib-") ? SMTP_PASS : undefined);

  if (apiKey) {
    return {
      async sendMail({ from, to, bcc, replyTo, subject, html }) {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: parseAddress(from),
            to: list(to),
            ...(list(bcc).length ? { bcc: list(bcc) } : {}),
            ...(replyTo ? { replyTo: parseAddress(replyTo) } : {}),
            subject,
            htmlContent: html,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(`Brevo API ${res.status}: ${body?.message ?? "error desconocido"}`);
        }
        return body; // { messageId }
      },
    };
  }

  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error("Correo no configurado: define BREVO_API_KEY o SMTP_USER/SMTP_PASS");
  }
  const port = Number(SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: SMTP_HOST || "smtp-relay.brevo.com",
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}
