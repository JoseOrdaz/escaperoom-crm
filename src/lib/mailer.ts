import nodemailer from "nodemailer";

export function createMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) throw new Error("SMTP_USER/SMTP_PASS no configurados");

  const port = Number(SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: SMTP_HOST || "smtp-relay.brevo.com",
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}
