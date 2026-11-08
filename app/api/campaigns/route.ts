/**
 * The campaign network API.
 *
 * Note what this endpoint will and will not accept. It takes a 64-bit hex
 * signature, a stage label, a tier and a family chosen from a fixed list. It
 * has no parameter for message text, and adding one would break the only
 * privacy claim the product makes. If a caller sends anything else, it is
 * ignored.
 */

import { NextResponse } from "next/server";
import { enqueueDemoReport, listCampaigns, lookup } from "@/lib/server/campaign-store";
import { STAGES, TIERS, type Stage, type Tier } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

const SIGNATURE = /^[0-9a-f]{16}$/;

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
    const match = lookup(signature);
    return NextResponse.json({ match });
  }

  return NextResponse.json({ campaigns: listCampaigns() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "expected JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "expected a report object" }, { status: 400 });
  }

  const input = body as Partial<{ signature: string; stage: string; tier: string; family: string }>;
  const allowedFields = new Set(["signature", "stage", "tier", "family"]);
  if (Object.keys(input).some((key) => !allowedFields.has(key))) {
    return NextResponse.json(
      { error: "only signature, stage, tier and family are accepted" },
      { status: 400 },
    );
  }

  if (typeof input.signature !== "string" || !SIGNATURE.test(input.signature)) {
    return NextResponse.json(
      { error: "signature must be 16 hex characters — message text is never accepted here" },
      { status: 400 },
    );
  }
  if (typeof input.stage !== "string" || !STAGES.includes(input.stage as Stage)) {
    return NextResponse.json({ error: "unknown stage" }, { status: 400 });
  }
  if (typeof input.tier !== "string" || !TIERS.includes(input.tier as Tier)) {
    return NextResponse.json({ error: "unknown tier" }, { status: 400 });
  }

  if (typeof input.family !== "string" || !FAMILIES.has(input.family)) {
    return NextResponse.json({ error: "unknown family" }, { status: 400 });
  }

  enqueueDemoReport({
    signature: input.signature,
    stage: input.stage as Stage,
    tier: input.tier as Tier,
    family: input.family,
  });

  return NextResponse.json({
    status: "pending_review",
    mode: "demo",
    message: "Queued for review. A single report never blocks a sender on its own.",
  }, { status: 202 });
}
