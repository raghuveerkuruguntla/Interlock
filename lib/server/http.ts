/**
 * Small helpers shared by the route handlers.
 */

import { NextResponse } from "next/server";

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Reject state-changing requests from another site.
 *
 * The session cookie is SameSite=Lax, which already stops most cross-site
 * POSTs; this is the second check. A request with no Origin header (curl,
 * server-to-server) is allowed — it carries no browser cookie.
 */
export function crossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
