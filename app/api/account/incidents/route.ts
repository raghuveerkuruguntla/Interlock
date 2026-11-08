import { NextResponse } from "next/server";
import { type CustomerAction, type IncidentReport } from "@/lib/account/types";
import { currentAccountId, getSnapshot, saveIncident } from "@/lib/server/accounts";
import { crossSite, error, readJson } from "@/lib/server/http";
import { EXPOSURE_KINDS, STAGES, TIERS, type ExposureKind, type SignalId } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

const ACTIONS: CustomerAction[] = [
  "ended_call",
  "verified_independently",
  "continued",
  "reported_exposure",
  "none",
];

export async function GET() {
  const id = await currentAccountId();
  if (!id) return error("Sign in first.", 401);
  const snap = await getSnapshot(id);
  return NextResponse.json({ incidents: snap?.incidents ?? [] });
}

function str(x: unknown, max: number): string {
  return typeof x === "string" ? x.slice(0, max) : "";
}

/**
 * Save a report. Every field is re-validated and length-capped, because the
 * report is built in the browser and this endpoint must not become a way to
 * store arbitrary text — in particular, never a full transcript.
 */
export async function POST(request: Request) {
  if (crossSite(request)) return error("Cross-site request refused.", 403);
  const id = await currentAccountId();
  if (!id) return error("Sign in to save reports to your account.", 401);
  const body = await readJson(request);
  const r = body?.report as Partial<IncidentReport> | undefined;
  if (!r || typeof r !== "object") return error("Expected a report.", 400);
  if (!STAGES.includes(r.stage as never) || !TIERS.includes(r.tier as never)) {
    return error("Bad stage or tier.", 400);
  }

  const result = await saveIncident(id, {
    source: r.source === "live_message" || r.source === "demo" ? r.source : "live_call",
    title: str(r.title, 120),
    summary: str(r.summary, 400),
    stage: r.stage!,
    tier: r.tier!,
    risk: typeof r.risk === "number" ? Math.min(1, Math.max(0, r.risk)) : 0,
    confidence: str(r.confidence, 200),
    signals: (Array.isArray(r.signals) ? r.signals : []).slice(0, 20).map((s) => ({
      id: str(s?.id, 40) as SignalId,
      label: str(s?.label, 120),
      evidence: str(s?.evidence, 140),
    })),
    customerAction: ACTIONS.includes(r.customerAction as CustomerAction)
      ? (r.customerAction as CustomerAction)
      : "none",
    customerResponse: str(r.customerResponse, 200),
    recommendedAction: str(r.recommendedAction, 300),
    nextSteps: (Array.isArray(r.nextSteps) ? r.nextSteps : []).slice(0, 8).map((x) => str(x, 300)),
    exposure: EXPOSURE_KINDS.includes(r.exposure as ExposureKind) ? (r.exposure as ExposureKind) : null,
    campaignSignature:
      typeof r.campaignSignature === "string" && /^[0-9a-f]{16}$/.test(r.campaignSignature)
        ? r.campaignSignature
        : null,
    reportedToNetwork: r.reportedToNetwork === true,
  });
  if (!result.ok) return error(result.error, result.status);
  return NextResponse.json({ incident: result.incident });
}
