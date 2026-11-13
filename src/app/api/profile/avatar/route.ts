import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { currentProfile, sameOrigin } from "@/lib/profile-session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const user = await currentProfile();
  if (!user) return NextResponse.json({ error: "Inicia sesión de nuevo" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "Selecciona una imagen de hasta 2 MB" }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const png = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const webp = buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  const mimeType = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
  if (!mimeType || file.type !== mimeType) return NextResponse.json({ error: "Usa una imagen PNG, JPEG o WebP" }, { status: 400 });
  const db = await connectDB();
  const id = new ObjectId();
  await db.collection("uploads").insertOne({ _id: id, filename: `avatar-${id}`, mimeType, data: buffer.toString("base64"), createdAt: new Date() });
  const avatar = `/api/uploads/${id}`;
  await db.collection("employees").updateOne({ _id: user._id }, { $set: { avatar, updatedAt: new Date() } });
  return NextResponse.json({ avatar });
}
