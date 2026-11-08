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
 * `*.vercel.app` address cannot have its own Clerk subdomain. That proxy is on
 * only when NEXT_PUBLIC_CLERK_PROXY_URL is set; local development talks to
 * Clerk directly.
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

const proxyEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PROXY_URL);

export default clerkMiddleware(
  async (auth, request) => {
    if (needsSignIn(request)) await auth.protect();
  },
  {
    // Send signed-out visitors to the site's own sign-in page, not Clerk's hosted one.
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    frontendApiProxy: { enabled: proxyEnabled, path: "/__clerk" },
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
