import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createProfileSession, PROFILE_COOKIE, SESSION_SECONDS } from "@/lib/profile-session";

export async function POST(req: Request) {
  const { username, password } = await req.json();
  if (!username || !password)
    return NextResponse.json({ error: "Faltan credenciales" }, { status: 400 });

  const db = await connectDB();

  // Buscar por email o username
  const user = await db.collection("employees").findOne({
    $or: [{ email: username }, { username }],
    deletedAt: { $exists: false },
  });

  if (!user)
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password || "");
  if (!valid)
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });

  // Guardar sesión simple (sin NextAuth, con cookie)
  const sessionData = {
    id: user._id,
    name: `${user.name} ${user.surname}`,
    email: user.email,
    role: user.role,
  };

  const profileToken = await createProfileSession(user._id);
  const response = NextResponse.json({ ok: true, user: sessionData });
  // "lax": la sesión se mantiene al abrir el CRM desde un enlace externo (email, WhatsApp…).
  // Las peticiones que modifican datos comprueban además el origen (sameOrigin).
  response.cookies.set(PROFILE_COOKIE, profileToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
  response.cookies.set("session_user", JSON.stringify(sessionData), {
    httpOnly: false, // visible en el navegador (solo para mostrar nombre/rol)
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS, // misma duración que la sesión real
  });
  return response;
}
