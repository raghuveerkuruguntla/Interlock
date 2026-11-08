/**
 * Clerk's Frontend API, served through this site at `/__clerk/*`.
 *
 * A `*.vercel.app` address cannot have its own Clerk subdomain, so in
 * production the browser loads Clerk's script and talks to Clerk through this
 * route. It runs as an ordinary route handler rather than inside the request
 * middleware, where a failure surfaced only as a bare 500 with nothing logged
 * to the browser. Any error here comes back as JSON with a reason (never the
 * keys), so a misconfiguration is visible.
 *
 * The folder is named `%5F%5Fclerk` because App Router treats folders that
 * start with `_` as private; `%5F` is Next's escape for a leading underscore.
 */

import { clerkFrontendApiProxy } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  try {
    return await clerkFrontendApiProxy(request, { proxyPath: "/__clerk" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: "clerk_proxy_failed", reason }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
