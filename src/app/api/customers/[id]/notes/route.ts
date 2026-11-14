import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireAccess } from "@/lib/access";

type Ctx = { params: Promise<{ id: string }> };
const isId = (v: string) => /^[a-f0-9]{24}$/i.test(v);

/* Notas internas de un cliente, guardadas en `customers.internalNotes` */
type Note = { _id: ObjectId; text: string; author: { id: string; name: string }; createdAt: Date };
const present = (n: Note) => ({ ...n, _id: String(n._id) });

export async function GET(_req: Request, context: Ctx) {
  const auth = await requireAccess(null, "customers.view");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!isId(id)) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
  const db = await connectDB();
  const c = await db.collection("customers").findOne({ _id: new ObjectId(id) }, { projection: { internalNotes: 1 } });
  if (!c) return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  const notes = ((c.internalNotes ?? []) as Note[]).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return NextResponse.json({ ok: true, items: notes.map(present) });
}

const noteSchema = z.object({ text: z.string().trim().min(1, "Escribe la nota").max(2000) });

export async function POST(req: Request, context: Ctx) {
  const auth = await requireAccess(req, "customers.view");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!isId(id)) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
  const parsed = noteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });

  const note: Note = {
    _id: new ObjectId(),
    text: parsed.data.text,
    author: { id: String(auth.access.id), name: auth.access.name },
    createdAt: new Date(),
  };
  const db = await connectDB();
  const res = await db
    .collection("customers")
    .updateOne({ _id: new ObjectId(id) }, { $push: { internalNotes: note } as never, $set: { updatedAt: new Date() } });
  if (res.matchedCount === 0) return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, item: present(note) });
}

/* DELETE ?noteId=… → solo el autor de la nota o un administrador */
export async function DELETE(req: Request, context: Ctx) {
  const auth = await requireAccess(req, "customers.view");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const noteId = new URL(req.url).searchParams.get("noteId") ?? "";
  if (!isId(id) || !isId(noteId)) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
  const db = await connectDB();
  const filter = auth.access.isAdmin
    ? { _id: new ObjectId(noteId) }
    : { _id: new ObjectId(noteId), "author.id": String(auth.access.id) };
  const res = await db
    .collection("customers")
    .updateOne({ _id: new ObjectId(id) }, { $pull: { internalNotes: filter } as never });
  if (res.modifiedCount === 0) return NextResponse.json({ ok: false, error: "No se pudo borrar la nota" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
