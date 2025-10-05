import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const runtime = "nodejs";        // Necesario para FS
export const dynamic = "force-dynamic"; // Evita caches / 404 fantasma en dev

// Pequeño healthcheck (útil para probar rápido en el navegador)
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/uploads" });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta 'file' en FormData" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Tipo de archivo inválido" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });

    const ext = (file.type.split("/")[1] || "png").replace("+xml", "");
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, filename), buffer);

    // URL pública
    const url = `/uploads/${filename}`;
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Upload error" },
      { status: 500 }
    );
  }
}
