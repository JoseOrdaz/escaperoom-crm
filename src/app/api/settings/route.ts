import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireAccess } from "@/lib/access";
import { ESCAPES } from "@/lib/permissions";
import { getEscapeSettings } from "@/lib/settings";

/* GET → ajustes públicos de cada escape (los usa también el formulario de reserva) */
export async function GET() {
  const db = await connectDB();
  return NextResponse.json({ ok: true, escapes: await getEscapeSettings(db) });
}

const url = z.string().trim().max(500).refine((v) => !v || /^https?:\/\//i.test(v), "La URL debe empezar por https://");
const escapeSchema = z.object({ privacyUrl: url, phone: z.string().trim().max(40), email: z.string().trim().max(120) });
const bodySchema = z.object({ escapes: z.record(z.enum(ESCAPES), escapeSchema.partial()) });

/* PUT → solo administradores, y solo sus escapes */
export async function PUT(req: Request) {
  const auth = await requireAccess(req, "rooms.manage");
  if (auth.response) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });

  const $set: Record<string, string> = {};
  for (const [escape, values] of Object.entries(parsed.data.escapes)) {
    if (!auth.access.escapes.includes(escape as (typeof ESCAPES)[number])) {
      return NextResponse.json({ ok: false, error: `No gestionas ${escape}` }, { status: 403 });
    }
    for (const [k, v] of Object.entries(values ?? {})) $set[`${escape}.${k}`] = v as string;
  }
  const db = await connectDB();
  await db.collection<{ _id: string }>("settings").updateOne({ _id: "escapes" }, { $set: { ...$set, updatedAt: new Date() } }, { upsert: true });
  return NextResponse.json({ ok: true, escapes: await getEscapeSettings(db) });
}
