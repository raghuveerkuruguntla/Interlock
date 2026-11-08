import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

/**
 * Clerk session handling for every page and API route.
 *
 * Signed-out visitors can still use the public pages and demos. The account
 * area needs a signed-in user; the incident console and the evidence,
 * network and limits pages additionally need the admin role, which each page
 * checks on the server (and the database checks again on every action — this
 * redirect is a convenience, not the security boundary).
 *
 * In production Clerk is reached through this site at `/__clerk`, because a
 * `*.vercel.app` address cannot have its own Clerk subdomain. That path is
 * served by the route handler in `app/%5F%5Fclerk`, not here — this
 * middleware never runs on it. The middleware only needs to know the proxy
 * address so it can validate sessions.
 *
 * Twilio webhooks pass straight through: they are authenticated by their
 * signature, never by a browser session.
 */
const needsSignIn = createRouteMatcher([
  "/account(.*)",
  "/onboarding(.*)",
  "/operator(.*)",
  "/evidence(.*)",
  "/network(.*)",
  "/limits(.*)",
]);

/**
 * The Clerk proxy address for this request: the explicit setting if there is
 * one, otherwise `<site>/__clerk` for production keys on a vercel.app address
 * (the same address Clerk gives the browser there). Local development with
 * test keys talks to Clerk directly.
 */
function proxyUrlFor(request: NextRequest): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const url = new URL(request.url);
  if (key.startsWith("pk_live_") && url.hostname.endsWith(".vercel.app")) {
    return `${url.origin}/__clerk`;
  }
  return undefined;
}

export default clerkMiddleware(
  async (auth, request) => {
    if (needsSignIn(request)) await auth.protect();
  },
  (request) => {
    const proxyUrl = proxyUrlFor(request);
    return {
      // Send signed-out visitors to the site's own sign-in page, not Clerk's hosted one.
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      ...(proxyUrl ? { proxyUrl } : {}),
    };
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals, Clerk's proxied Frontend API (its own route
    // handler) and static files unless they appear in search params.
    "/((?!_next|__clerk|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
