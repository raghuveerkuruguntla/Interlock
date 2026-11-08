import { NextResponse } from "next/server";
import { authenticate } from "@/lib/server/accounts";
import {
  createSessionToken,
  normaliseEmail,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/server/auth";
import { crossSite, error, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (crossSite(request)) return error("Cross-site request refused.", 403);
  const body = await readJson(request);
  const email = normaliseEmail(body?.email);
  if (!body || !email || typeof body.password !== "string") {
    return error("Enter your email and password.", 400);
  }
  const user = await authenticate(email, body.password);
  // One message for both cases, so the form cannot be used to probe which emails exist.
  if (!user) return error("That email and password do not match an account.", 401);

  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
  return res;
}
