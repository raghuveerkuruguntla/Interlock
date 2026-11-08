import { NextResponse } from "next/server";
import { currentAccountId, updateConsent } from "@/lib/server/accounts";
import { crossSite, error, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Change consent. Takes effect on the next request: a live session re-checks
 * call-analysis consent on every poll and every incoming segment, so switching
 * it off stops analysis without waiting for the session to end.
 */
export async function PUT(request: Request) {
  if (crossSite(request)) return error("Cross-site request refused.", 403);
  const id = await currentAccountId();
  if (!id) return error("Sign in first.", 401);
  const body = await readJson(request);
  if (!body) return error("Expected JSON.", 400);
  const consent = (body.consent ?? {}) as Record<string, unknown>;
  const snapshot = await updateConsent(id, consent, body.acceptNotice === true);
  if (!snapshot) return error("Account not found.", 404);
  return NextResponse.json({ account: snapshot });
}
