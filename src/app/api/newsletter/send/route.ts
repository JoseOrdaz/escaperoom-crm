import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireAccess } from "@/lib/access";
import { escapeToBrand } from "@/lib/permissions";
import { sendLoggedEmail } from "@/lib/email-log";
import { buildNewsletterEmail, listRecipients, pickAudience, unsubscribeUrl, type Audience } from "@/lib/newsletter";

export const maxDuration = 60;

const MAX_RECIPIENTS = 1000;

const bodySchema = z.object({
  brand: z.enum(["fobia", "action"]),
  subject: z.string().trim().min(1, "Escribe el asunto").max(200),
  title: z.string().trim().max(120).optional(),
  format: z.enum(["fields", "html"]).default("fields"),
  message: z.string().trim().max(10000).optional(),
  /** HTML libre (editor visual o código pegado), hasta ~800 KB */
  html: z.string().max(800_000).optional(),
  wrap: z.boolean().default(true),
  ctaText: z.string().trim().max(60).optional(),
  ctaUrl: z.string().trim().max(500).optional(),
  audience: z.discriminatedUnion("type", [
    z.object({ type: z.literal("all") }),
    z.object({ type: z.literal("fobia") }),
    z.object({ type: z.literal("action") }),
    z.object({ type: z.literal("selected"), ids: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).min(1) }),
  ]),
  /** true → solo se envía una prueba al email del usuario que envía */
  test: z.boolean().default(false),
}).refine((d) => (d.format === "html" ? !!d.html?.replace(/<[^>]*>/g, "").trim() || /<img/i.test(d.html ?? "") : !!d.message?.trim()), {
  message: "Escribe el contenido del correo",
});

/* POST → enviar newsletter / aviso general */
export async function POST(req: Request) {
  const auth = await requireAccess(req, "newsletter.send");
  if (auth.response) return auth.response;
  const access = auth.access;
  const allowedBrands = access.escapes.map(escapeToBrand);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const d = parsed.data;
  // Texto corto para el registro (el HTML completo queda guardado en cada correo)
  const summary =
    d.format === "html"
      ? (d.html ?? "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)
      : d.message ?? "";
  if (!allowedBrands.includes(d.brand)) {
    return NextResponse.json({ ok: false, error: "Solo puedes enviar como los escapes que tienes asociados" }, { status: 403 });
  }
  const sentBy = { id: String(access.id), name: access.name };
  const db = await connectDB();

  // ── Prueba: solo al propio usuario ──
  if (d.test) {
    if (!access.email) return NextResponse.json({ ok: false, error: "Tu perfil no tiene email" }, { status: 400 });
    const mail = buildNewsletterEmail({ ...d, subject: `[PRUEBA] ${d.subject}`, recipientName: access.name });
    const r = await sendLoggedEmail(
      db,
      { trigger: "newsletter", event: "newsletter", sentBy, message: summary },
      { from: mail.from, to: access.email, subject: mail.subject, html: mail.html }
    );
    return NextResponse.json({ ...r, test: true, to: access.email }, { status: r.ok ? 200 : 502 });
  }

  // ── Envío real ──
  const recipients = pickAudience(await listRecipients(db), d.audience as Audience, allowedBrands);
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "No hay destinatarios (o todos se dieron de baja)" }, { status: 400 });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json({ ok: false, error: `Máximo ${MAX_RECIPIENTS} destinatarios por envío` }, { status: 400 });
  }

  const campaign = await db.collection("email_campaigns").insertOne({
    brand: d.brand,
    subject: d.subject,
    title: d.title ?? "",
    format: d.format,
    message: d.message ?? "",
    html: d.format === "html" ? d.html ?? "" : "",
    wrap: d.wrap,
    summary,
    ctaText: d.ctaText ?? "",
    ctaUrl: d.ctaUrl ?? "",
    audience: d.audience.type,
    total: recipients.length,
    sent: 0,
    failed: 0,
    status: "sending",
    sentBy,
    createdAt: new Date(),
  });

  let sent = 0;
  let failed = 0;
  const queue = [...recipients];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const mail = buildNewsletterEmail({ ...d, recipientName: r.name, unsubscribeLink: unsubscribeUrl(r._id) });
      const res = await sendLoggedEmail(
        db,
        { trigger: "newsletter", event: "newsletter", customerId: r._id, sentBy, message: summary, campaignId: campaign.insertedId },
        { from: mail.from, to: r.email, subject: mail.subject, html: mail.html }
      );
      if (res.ok) sent++;
      else failed++;
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));

  await db
    .collection("email_campaigns")
    .updateOne({ _id: campaign.insertedId }, { $set: { sent, failed, status: "done", finishedAt: new Date() } });

  return NextResponse.json({ ok: true, total: recipients.length, sent, failed, campaignId: String(campaign.insertedId) });
}
