import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; 
    const db = await connectDB();
    const file = await db.collection("uploads").findOne({ _id: new ObjectId(id) });
    if (!file) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const buffer = Buffer.from(file.data, "base64");
    return new Response(buffer, {
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (err) {
    console.error("Error en GET /api/uploads/[id]:", err);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

