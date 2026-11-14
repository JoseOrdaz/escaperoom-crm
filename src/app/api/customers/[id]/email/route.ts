import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireAccess } from "@/lib/access";
import { escapeToBrand } from "@/lib/permissions";
import { sendLoggedEmail } from "@/lib/email-log";
import { buildNewsletterEmail } from "@/lib/newsletter-template";

const BCC = "joseordazsuay@gmail.com";

const bodySchema = z.object({
  brand: z.enum(["fobia", "action"]),
  subject: z.string().trim().min(1, "Escribe el asunto").max(200),
  message: z.string().trim().min(1, "Escribe el mensaje").max(5000),
});

/* POST → correo directo a un cliente (queda en el registro como mensaje manual) */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAccess(req, "customers.view");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
  const { brand, subject, message } = parsed.data;
  if (!auth.access.escapes.map(escapeToBrand).includes(brand)) {
    return NextResponse.json({ ok: false, error: "Solo puedes escribir como tus escapes" }, { status: 403 });
  }

  const db = await connectDB();
  const customer = await db.collection("customers").findOne({ _id: new ObjectId(id) }, { projection: { name: 1, email: 1 } });
  if (!customer?.email) return NextResponse.json({ ok: false, error: "El cliente no tiene email" }, { status: 400 });

  // Mismo diseño de marca que los avisos, sin enlace de baja (es un mensaje personal, no comercial)
  const mail = buildNewsletterEmail({ brand, subject, message, recipientName: customer.name });
  const result = await sendLoggedEmail(
    db,
    { trigger: "manual", event: "manual", customerId: customer._id, sentBy: { id: String(auth.access.id), name: auth.access.name }, message },
    { from: mail.from, to: customer.email, bcc: BCC, subject: mail.subject, html: mail.html }
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
