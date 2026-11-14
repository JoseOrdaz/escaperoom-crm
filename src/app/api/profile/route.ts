import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { currentProfile, sameOrigin } from "@/lib/profile-session";
import { PERMISSION_LABEL, can, employeeEscapes, normalizeRole, type Permission } from "@/lib/permissions";

const schema = z.object({ name: z.string().trim().min(1).max(80), surname: z.string().trim().min(1).max(80), email: z.string().trim().email().max(254), username: z.string().trim().min(1).max(80).optional() });
function present(user: any) {
  const role = normalizeRole(user.role);
  return {
    name: user.name ?? "", surname: user.surname ?? "", email: user.email ?? "", username: user.username ?? "", avatar: user.avatar ?? "", role,
    escapes: employeeEscapes(user),
    permissions: (Object.keys(PERMISSION_LABEL) as Permission[]).filter((p) => can(role, p)),
  };
}
export async function GET() {
  const user = await currentProfile();
  if (!user) return NextResponse.json({ error: "Inicia sesión de nuevo" }, { status: 401 });
  return NextResponse.json(present(user));
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const user = await currentProfile();
  if (!user) return NextResponse.json({ error: "Inicia sesión de nuevo" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa el nombre, los apellidos y el correo electrónico" }, { status: 400 });
  const data = { ...parsed.data, email: parsed.data.email.toLowerCase() };
  const db = await connectDB();
  const existing = await db.collection("employees").findOne({ _id: { $ne: user._id }, $or: [{ email: data.email }, ...(data.username ? [{ username: data.username }] : [])] });
  if (existing) return NextResponse.json({ error: "El correo o el usuario ya están en uso" }, { status: 409 });
  await db.collection("employees").updateOne({ _id: user._id }, { $set: { ...data, updatedAt: new Date() } });
  const response = NextResponse.json(present({ ...user, ...data }));
  response.cookies.set("session_user", JSON.stringify({ id: user._id, name: `${data.name} ${data.surname}`, email: data.email, role: user.role }), { path: "/", sameSite: "lax" });
  return response;
}
