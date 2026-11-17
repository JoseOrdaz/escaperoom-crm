import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireAccess } from "@/lib/access";
import { escapeToBrand } from "@/lib/permissions";
import { loadTemplate } from "@/lib/reservation-emails";
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS, type Brand, type TemplateKey } from "@/lib/email-templates";

const brandSchema = z.enum(["fobia", "action"]);
const keySchema = z.enum(TEMPLATE_KEYS as [TemplateKey, ...TemplateKey[]]);

async function allowed(req: Request | null) {
  const auth = await requireAccess(req, "emails.view");
  if (auth.response) return { response: auth.response };
  return { brands: auth.access.escapes.map(escapeToBrand) as Brand[], name: auth.access.name };
}

/* GET → plantillas (guardadas o por defecto) de mis escapes */
export async function GET() {
  const a = await allowed(null);
  if (a.response) return a.response;
  const db = await connectDB();
  const out: Record<string, Record<string, unknown>> = {};
  const custom = await db.collection<{ _id: string; updatedAt?: Date; updatedBy?: string }>("email_templates").find({}).toArray();
  for (const brand of a.brands) {
    out[brand] = {};
    for (const key of TEMPLATE_KEYS) {
      const saved = custom.find((c) => c._id === `${brand}:${key}`);
      out[brand][key] = { ...(await loadTemplate(db, brand, key)), customized: !!saved, updatedAt: saved?.updatedAt ?? null, updatedBy: saved?.updatedBy ?? null };
    }
  }
  return NextResponse.json({ ok: true, brands: a.brands, templates: out, defaults: DEFAULT_TEMPLATES });
}

const putSchema = z.object({
  brand: brandSchema,
  key: keySchema,
  template: z.object({
    subject: z.string().trim().min(1, "El asunto no puede estar vacío").max(200),
    heading: z.string().trim().min(1).max(120),
    intro: z.string().trim().max(1000),
    body: z.string().max(10000),
    showDetails: z.boolean(),
    showCancelLink: z.boolean(),
  }),
});

/* PUT → guardar una plantilla */
export async function PUT(req: Request) {
  const a = await allowed(req);
  if (a.response) return a.response;
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const { brand, key, template } = parsed.data;
  if (!a.brands.includes(brand)) return NextResponse.json({ ok: false, error: "No gestionas ese escape" }, { status: 403 });
  const db = await connectDB();
  await db.collection<{ _id: string }>("email_templates").updateOne(
    { _id: `${brand}:${key}` },
    { $set: { ...template, updatedAt: new Date(), updatedBy: a.name } },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}

/* DELETE ?brand=&key= → volver al texto por defecto */
export async function DELETE(req: Request) {
  const a = await allowed(req);
  if (a.response) return a.response;
  const sp = new URL(req.url).searchParams;
  const brand = brandSchema.safeParse(sp.get("brand"));
  const key = keySchema.safeParse(sp.get("key"));
  if (!brand.success || !key.success) return NextResponse.json({ ok: false, error: "Parámetros inválidos" }, { status: 400 });
  if (!a.brands.includes(brand.data)) return NextResponse.json({ ok: false, error: "No gestionas ese escape" }, { status: 403 });
  const db = await connectDB();
  await db.collection<{ _id: string }>("email_templates").deleteOne({ _id: `${brand.data}:${key.data}` });
  return NextResponse.json({ ok: true });
}
