import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";

export const PROFILE_COOKIE = "profile_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createProfileSession(employeeId: unknown) {
  const token = randomBytes(32).toString("hex");
  const db = await connectDB();
  await db.collection("profile_sessions").insertOne({ tokenHash: tokenHash(token), employeeId, expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
  return token;
}

export async function currentProfile() {
  const token = (await cookies()).get(PROFILE_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = await connectDB();
  const session = await db.collection("profile_sessions").findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  return db.collection("employees").findOne({ _id: session.employeeId, deletedAt: { $exists: false } });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
