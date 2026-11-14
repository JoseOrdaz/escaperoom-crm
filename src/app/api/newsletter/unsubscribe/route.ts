import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "@/lib/db";
import { verifyUnsubscribe } from "@/lib/newsletter";

/* GET → baja de la newsletter desde el enlace del correo (público, firmado) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const c = url.searchParams.get("c") ?? "";
  const t = url.searchParams.get("t") ?? "";
  const done = new URL("/baja", url.origin);

  if (!/^[a-f0-9]{24}$/i.test(c) || !verifyUnsubscribe(c, t)) {
    done.searchParams.set("error", "1");
    return NextResponse.redirect(done);
  }
  const db = await connectDB();
  const customer = await db.collection("customers").findOne({ _id: new ObjectId(c) }, { projection: { email: 1 } });
  if (customer?.email) {
    // Todas las fichas con ese email quedan dadas de baja
    await db
      .collection("customers")
      .updateMany({ email: customer.email }, { $set: { newsletterOptOut: true, newsletterOptOutAt: new Date() } });
  }
  return NextResponse.redirect(done);
}
