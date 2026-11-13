import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { currentProfile, sameOrigin } from "@/lib/profile-session";
import { passwordError } from "@/lib/password-policy.mjs";

const fields = z.object({
  name: z.string().trim().min(1).max(80),
  surname: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  username: z.string().trim().max(80).optional(),
  role: z.enum(["admin", "game_master"]),
  escape: z.string().trim().max(100).optional(),
  password: z.string().optional(),
});
async function admin(request: Request) {
  if (!sameOrigin(request)) return { error: "Origen no permitido", status: 403 };
  const user = await currentProfile();
  if (!user) return { error: "Inicia sesión de nuevo", status: 401 };
  if (user.role !== "admin") return { error: "Se requieren permisos de administrador", status: 403 };
  return { user };
}

export async function GET() {
  const db = await connectDB();
  const employees = await db.collection("employees").find({ deletedAt: { $exists: false } }).project({ password: 0 }).toArray();
  return NextResponse.json(employees);
}

export async function POST(req: Request) {
  const auth = await admin(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = fields.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa los datos del empleado" }, { status: 400 });
  const error = passwordError(parsed.data.password);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const { password, ...data } = parsed.data;
  const email = data.email.toLowerCase();
  const username = data.username || email.split("@")[0];
  const db = await connectDB();
  if (await db.collection("employees").findOne({ deletedAt: { $exists: false }, $or: [{ email }, { username }] })) return NextResponse.json({ error: "El correo o el usuario ya están en uso" }, { status: 409 });
  const newEmp = { ...data, email, username, password: await bcrypt.hash(password!, 10), avatar: "", weeklySchedule: {}, checkins: [], createdAt: new Date() };
  const result = await db.collection("employees").insertOne(newEmp);
  return NextResponse.json({ ok: true, _id: result.insertedId });
}

export async function PUT(req: Request) {
  const auth = await admin(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null);
  if (!ObjectId.isValid(body?._id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const parsed = fields.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revisa los datos del empleado" }, { status: 400 });
  const { password, ...data } = parsed.data;
  if (password) { const error = passwordError(password); if (error) return NextResponse.json({ error }, { status: 400 }); }
  const db = await connectDB();
  const id = new ObjectId(body._id);
  const employee = await db.collection("employees").findOne({ _id: id, deletedAt: { $exists: false } });
  if (!employee) return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  if (employee.role === "admin" && data.role !== "admin" && await db.collection("employees").countDocuments({ role: "admin", deletedAt: { $exists: false } }) <= 1) return NextResponse.json({ error: "Debe quedar al menos un administrador" }, { status: 409 });
  const email = data.email.toLowerCase();
  const username = data.username || email.split("@")[0];
  if (await db.collection("employees").findOne({ _id: { $ne: id }, deletedAt: { $exists: false }, $or: [{ email }, { username }] })) return NextResponse.json({ error: "El correo o el usuario ya están en uso" }, { status: 409 });
  await db.collection("employees").updateOne({ _id: id }, { $set: { ...data, email, username, updatedAt: new Date(), ...(password ? { password: await bcrypt.hash(password, 10) } : {}) } });
  if (password || employee.role !== data.role) await db.collection("profile_sessions").deleteMany({ employeeId: id });
  const reauthRequired = String(auth.user!._id) === String(id) && Boolean(password || employee.role !== data.role);
  return NextResponse.json({ ok: true, reauthRequired });
}

export async function DELETE(req: Request) {
  const auth = await admin(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !ObjectId.isValid(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const objectId = new ObjectId(id);
  if (String(auth.user!._id) === id) return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 409 });
  const db = await connectDB();
  const employee = await db.collection("employees").findOne({ _id: objectId, deletedAt: { $exists: false } });
  if (!employee) return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  if (employee.role === "admin" && await db.collection("employees").countDocuments({ role: "admin", deletedAt: { $exists: false } }) <= 1) return NextResponse.json({ error: "Debe quedar al menos un administrador" }, { status: 409 });
  await db.collection("employees").updateOne({ _id: objectId }, { $set: { deletedAt: new Date(), updatedAt: new Date() } });
  await db.collection("profile_sessions").deleteMany({ employeeId: objectId });
  return NextResponse.json({ ok: true });
}
