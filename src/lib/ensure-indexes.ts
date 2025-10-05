// src/lib/ensure-indexes.ts
import { connectDB } from "@/lib/db";

export async function ensureIndexes() {
  const db = await connectDB();
  await db.collection("customers").createIndex({ email: 1 }, { unique: true, sparse: true });
  await db.collection("reservations").createIndex({ roomId: 1, start: 1 });
  await db.collection("reservations").createIndex({ customerId: 1 });
}
