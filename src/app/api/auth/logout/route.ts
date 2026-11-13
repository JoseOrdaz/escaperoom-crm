import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { PROFILE_COOKIE, tokenHash } from "@/lib/profile-session";

export async function POST() {
  const token = (await cookies()).get(PROFILE_COOKIE)?.value;
  if (token) {
    const db = await connectDB();
    await db.collection("profile_sessions").deleteOne({ tokenHash: tokenHash(token) });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("session_user");
  res.cookies.delete(PROFILE_COOKIE);
  return res;
}
