import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Clerk session handling for every page and API route.
 *
 * Signed-out visitors can still use the public pages and demos. The account
 * area needs a signed-in user; the incident console and the evidence pages
 * additionally need the admin role, which each page checks on the server (and
 * the database checks again on every action — this redirect is a
 * convenience, not the security boundary).
 *
 * In production Clerk is reached through this site at `/__clerk`, because a
 * `*.vercel.app` address cannot have its own Clerk subdomain. Clerk does that
 * automatically for production keys on vercel.app; local development (test
 * keys) talks to Clerk directly.
 *
 * Twilio webhooks pass straight through: they are authenticated by their
 * signature, never by a browser session.
 */
const needsSignIn = createRouteMatcher([
  "/account(.*)",
  "/onboarding(.*)",
  "/operator(.*)",
  "/evidence(.*)",
]);

/**
 * Only configure the proxy when it is set explicitly. Otherwise leave it
 * unset: Clerk then proxies `*.vercel.app` production sites through `/__clerk`
 * automatically. Passing `enabled: false` would switch that automatic proxy
 * off, which breaks sign-in on a vercel.app address.
 */
const explicitProxy = process.env.NEXT_PUBLIC_CLERK_PROXY_URL
  ? { frontendApiProxy: { enabled: true, path: "/__clerk" } }
  : {};

export default clerkMiddleware(
  async (auth, request) => {
    if (needsSignIn(request)) await auth.protect();
  },
  {
    // Send signed-out visitors to the site's own sign-in page, not Clerk's hosted one.
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    ...explicitProxy,
  },
);

export const config = {
  matcher: [
    // Clerk's proxied Frontend API, including its script files.
    "/__clerk/(.*)",
    // Skip Next.js internals and static files unless they appear in search params.
    "/((?!_next|__clerk|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
