import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { username, password } = await req.json();
  if (!username || !password)
    return NextResponse.json({ error: "Faltan credenciales" }, { status: 400 });

  const db = await connectDB();

  // Buscar por email o username
  const user = await db.collection("employees").findOne({
    $or: [{ email: username }, { username }],
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

  const response = NextResponse.json({ ok: true, user: sessionData });
  response.cookies.set("session_user", JSON.stringify(sessionData), {
    httpOnly: false, // visible en el navegador
    path: "/",
  });
  return response;
}
