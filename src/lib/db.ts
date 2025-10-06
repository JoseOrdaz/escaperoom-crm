// src/lib/db.ts
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
if (!uri) throw new Error("MONGODB_URI not set");

const dbName = "escape_crm";

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (database) return database;

  client = new MongoClient(uri);
  await client.connect();

  database = client.db(dbName);
  return database;
}
