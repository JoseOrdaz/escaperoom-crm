// src/lib/db.ts
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
if (!uri) throw new Error("MONGODB_URI not set");

const dbName = "escape_crm";

/**
 * Una sola conexión (pool) para todo el proceso.
 *
 * Se guarda en `globalThis` para que la compartan todas las rutas y sobreviva a
 * las recargas en desarrollo: abrir una conexión nueva a Atlas cuesta cientos de
 * ms (TLS + selección de servidor) y, si la red va mal, hasta el timeout.
 * Antes cada ruta (y cada petición simultánea) abría la suya.
 */
const globalForMongo = globalThis as unknown as { __mongoDbPromise?: Promise<Db> };

function connect(): Promise<Db> {
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000, // fallar rápido en vez de colgar 30 s
    connectTimeoutMS: 8000,
    maxIdleTimeMS: 5 * 60_000,
  });
  return client
    .connect()
    .then((c) => c.db(dbName))
    .catch((err) => {
      // Si falla, no dejamos la promesa rota en caché: el siguiente intento reconecta
      globalForMongo.__mongoDbPromise = undefined;
      client.close().catch(() => {});
      throw err;
    });
}

export function connectDB(): Promise<Db> {
  globalForMongo.__mongoDbPromise ??= connect();
  return globalForMongo.__mongoDbPromise;
}
