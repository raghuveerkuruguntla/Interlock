import { NextResponse } from "next/server";
import { currentAccountId, getSnapshot, recordActivity } from "@/lib/server/accounts";
import { crossSite, error, readJson } from "@/lib/server/http";
import { kv } from "@/lib/server/kv";
import { armSession } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/**
 * Arming the shared number needs a code on any deployed site. Without one, a
 * stranger could arm it and read the transcript of whoever calls next. Local
 * development may leave it unset.
 */
function armCodeRequired(): boolean {
  return Boolean(process.env.LIVE_ARM_CODE) || process.env.NODE_ENV === "production";
}

/** What the live page needs to know about how the phone path is configured. */
export async function GET() {
  const store = kv();
  return NextResponse.json(
    {
      phoneNumber: process.env.TWILIO_PHONE_NUMBER ?? null,
      twilioConfigured: Boolean(process.env.TWILIO_AUTH_TOKEN),
      forwardConfigured: Boolean(process.env.INTERLOCK_FORWARD_TO),
      armCodeRequired: armCodeRequired(),
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
  // Nothing to arm until the phone number exists.
  if (!process.env.TWILIO_AUTH_TOKEN) {
    return error("Phone mode is not set up on this site yet. Use microphone mode instead.", 503);
  }
  const armCode = process.env.LIVE_ARM_CODE;
  if (armCodeRequired() && !armCode) {
    return error("Phone mode needs an arm code. Set LIVE_ARM_CODE for this site first.", 503);
  }
  if (armCode && body.armCode !== armCode) return error("That arm code is not right.", 403);

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
