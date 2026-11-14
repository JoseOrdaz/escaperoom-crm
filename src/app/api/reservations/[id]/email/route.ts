import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { currentProfile, sameOrigin } from "@/lib/profile-session";
import { sendReservationEmail } from "@/lib/reservation-emails";

const bodySchema = z.object({
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, "Escribe un mensaje").max(5000),
  includeDetails: z.boolean().default(true),
});

/* POST → enviar un mensaje manual al cliente de la reserva */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido" }, { status: 403 });
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ ok: false, error: "Inicia sesión de nuevo" }, { status: 401 });

  const { id } = await context.params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const db = await connectDB();
  const result = await sendReservationEmail(db, {
    reservationId: new ObjectId(id),
    kind: "manual",
    trigger: "manual",
    event: "manual",
    subject: parsed.data.subject,
    message: parsed.data.message,
    includeDetails: parsed.data.includeDetails,
    sentBy: { id: String(profile._id), name: `${profile.name ?? ""} ${profile.surname ?? ""}`.trim() },
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
