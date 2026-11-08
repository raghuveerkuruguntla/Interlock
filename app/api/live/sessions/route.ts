import { NextResponse } from "next/server";
import { currentAccountId, getSnapshot, recordActivity } from "@/lib/server/accounts";
import { crossSite, error, readJson } from "@/lib/server/http";
import { kv } from "@/lib/server/kv";
import { armSession } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/** What the live page needs to know about how the phone path is configured. */
export async function GET() {
  const store = kv();
  return NextResponse.json(
    {
      phoneNumber: process.env.TWILIO_PHONE_NUMBER ?? null,
      twilioConfigured: Boolean(process.env.TWILIO_AUTH_TOKEN),
      forwardConfigured: Boolean(process.env.INTERLOCK_FORWARD_TO),
      armCodeRequired: Boolean(process.env.LIVE_ARM_CODE),
      store: { kind: store.kind, durable: store.durable },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Arm a phone session. Requires explicit consent in the request itself — for
 * a signed-in customer, their saved call-analysis consent as well — and, when
 * LIVE_ARM_CODE is set, the demo code, so a stranger on the public site cannot
 * arm the shared number and read someone else's call.
 */
export async function POST(request: Request) {
  if (crossSite(request)) return error("Cross-site request refused.", 403);
  const body = await readJson(request);
  if (!body) return error("Expected JSON.", 400);
  const consent = (body.consent ?? {}) as Record<string, unknown>;
  if (consent.analysis !== true || consent.participantsNotified !== true) {
    return error("Live analysis needs your consent and confirmation that everyone on the call has been told.", 400);
  }
  const armCode = process.env.LIVE_ARM_CODE;
  if (armCode && body.armCode !== armCode) return error("That demo arm code is not right.", 403);

  const ownerId = await currentAccountId();
  if (ownerId) {
    const snap = await getSnapshot(ownerId);
    if (!snap?.consent.callAnalysis) {
      return error("Live call analysis is switched off in your privacy settings. Turn it on there first.", 403);
    }
  }

  const result = await armSession(ownerId);
  if (!result.ok) return error(result.error, result.status);
  if (ownerId) await recordActivity(ownerId, "live_session_started", "Phone");
  return NextResponse.json({
    session: { id: result.session.id, status: result.session.status },
    phoneNumber: process.env.TWILIO_PHONE_NUMBER ?? null,
  });
}
