import { connectDB } from "@/lib/db";
import { ObjectId } from "mongodb";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";


export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File))
      return NextResponse.json({ error: "Falta 'file'" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    const db = await connectDB();
    const result = await db.collection("uploads").insertOne({
      _id: new ObjectId(),
      filename: `${Date.now()}-${randomUUID()}`,
      mimeType: file.type,
      data: base64,
      createdAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      id: result.insertedId,
      // URL de lectura directa
      url: `/api/uploads/${result.insertedId}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error upload" }, { status: 500 });
  }
}
