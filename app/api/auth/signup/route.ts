import { NextResponse } from "next/server";
import { createAccount } from "@/lib/server/accounts";
import {
  createSessionToken,
  normaliseEmail,
  SESSION_COOKIE,
  sessionCookieOptions,
  validatePassword,
} from "@/lib/server/auth";
import { crossSite, error, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (crossSite(request)) return error("Cross-site request refused.", 403);
  const body = await readJson(request);
  if (!body) return error("Expected JSON.", 400);
  const email = normaliseEmail(body.email);
  if (!email) return error("Enter a valid email address.", 400);
  const problem = validatePassword(body.password);
  if (problem) return error(problem, 400);
  const name = typeof body.name === "string" ? body.name : "";

  const result = await createAccount(email, name, body.password as string);
  if (!result.ok) return error(result.error, 409);

  const res = NextResponse.json({ user: result.user });
  res.cookies.set(SESSION_COOKIE, createSessionToken(result.user.id), sessionCookieOptions());
  return res;
}
