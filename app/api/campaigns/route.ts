/**
 * The campaign network API.
 *
 * Note what this endpoint will and will not accept. It takes a 64-bit hex
 * signature, a stage label, a tier, a family chosen from a fixed list, and a
 * random device token which is hashed before anything is stored. It has no
 * parameter for message text, and adding one would break the only privacy
 * claim the product makes. Anything else in the body is ignored.
 */

import { NextResponse } from "next/server";
import {
  hashReporter,
  listCampaigns,
  lookup,
  RATE_LIMIT_PER_HOUR,
  report,
  storeStatus,
} from "@/lib/server/campaign-store";
import { STAGES, TIERS, type Stage, type Tier } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

const SIGNATURE = /^[0-9a-f]{16}$/;

/**
 * The device token the browser generates and keeps. Constrained in shape so an
 * oversized or structured value cannot be smuggled through this field — the
 * point of the token is that it carries nothing but randomness.
 */
const REPORTER_TOKEN = /^[A-Za-z0-9_-]{8,100}$/;

/** Families are an enum, never free text, so nothing identifying can ride along. */
const FAMILIES = new Set([
  "Phone line takeover",
  "Bank alert",
  "Package delivery",
  "Road toll",
  "Job offer",
  "Family emergency",
  "Tech support",
  "QR payment",
  "Government",
  "Verification code",
  "Other",
]);

export async function GET(request: Request) {
  const signature = new URL(request.url).searchParams.get("signature");

  if (signature) {
    if (!SIGNATURE.test(signature)) {
      return NextResponse.json({ error: "signature must be 16 hex characters" }, { status: 400 });
    }
    return NextResponse.json({ match: await lookup(signature) });
  }

  return NextResponse.json({
    campaigns: await listCampaigns(),
    store: storeStatus(),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "expected JSON" }, { status: 400 });
  }

  const input = body as Partial<{
    signature: string;
    stage: string;
    tier: string;
    family: string;
    reporter: string;
  }>;

  if (typeof input.signature !== "string" || !SIGNATURE.test(input.signature)) {
    return NextResponse.json(
      { error: "signature must be 16 hex characters — message text is never accepted here" },
      { status: 400 },
    );
  }
  if (!STAGES.includes(input.stage as Stage)) {
    return NextResponse.json({ error: "unknown stage" }, { status: 400 });
  }
  if (!TIERS.includes(input.tier as Tier)) {
    return NextResponse.json({ error: "unknown tier" }, { status: 400 });
  }
  if (typeof input.reporter !== "string" || !REPORTER_TOKEN.test(input.reporter)) {
    return NextResponse.json(
      {
        error:
          "a random device token is required, so that one person's reports count once and can be rate limited",
      },
      { status: 400 },
    );
  }

  const family = FAMILIES.has(input.family ?? "") ? (input.family as string) : "Other";

  const result = await report({
    signature: input.signature,
    stage: input.stage as Stage,
    tier: input.tier as Tier,
    family,
    // The raw token stops here. Only its hash reaches storage.
    reporterHash: hashReporter(input.reporter),
  });

  if (result.throttled) {
    return NextResponse.json(
      {
        error: `This device has filed more than ${RATE_LIMIT_PER_HOUR} reports this hour.`,
        throttled: true,
      },
      { status: 429 },
    );
  }

  return NextResponse.json({
    campaign: result.campaign,
    isNew: result.isNew,
    store: storeStatus(),
    accepted: {
      signature: input.signature,
      stage: input.stage,
      tier: input.tier,
      family,
      reporter: "sha256(device token), truncated",
    },
    note: "No message text was sent, received or stored by this endpoint.",
  });
}
