import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { currentProfile, sameOrigin, PROFILE_COOKIE, tokenHash } from "@/lib/profile-session";
import { passwordError } from "@/lib/password-policy.mjs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const user = await currentProfile();
  if (!user) return NextResponse.json({ error: "Inicia sesión de nuevo" }, { status: 401 });
  const data = await request.json().catch(() => null);
  const error = passwordError(data?.newPassword);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (typeof data?.currentPassword !== "string" || !user.password || !(await bcrypt.compare(data.currentPassword, user.password))) {
    return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 400 });
  }
  const db = await connectDB();
  const token = (await cookies()).get(PROFILE_COOKIE)?.value;
  const result = await db.collection("employees").updateOne({ _id: user._id, password: user.password }, { $set: { password: await bcrypt.hash(data.newPassword, 10), updatedAt: new Date() } });
  if (!result.matchedCount) return NextResponse.json({ error: "La contraseña ha cambiado. Inténtalo de nuevo." }, { status: 409 });
  await db.collection("profile_sessions").deleteMany({ employeeId: user._id, ...(token ? { tokenHash: { $ne: tokenHash(token) } } : {}) });
  return NextResponse.json({ ok: true });
}
