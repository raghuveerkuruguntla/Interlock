import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/campaigns/route";
import {
  listCampaigns,
  lookup,
  pendingDemoReportCount,
} from "@/lib/server/campaign-store";
import { signatureOf } from "@/lib/engine/signature";

function postReport(body: unknown): Promise<Response> {
  return POST(new Request("http://localhost/api/campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
}

const validReport = {
  signature: "0123456789abcdef",
  stage: "hook",
  tier: "elevated",
  family: "Other",
};

describe("campaign report trust boundary", () => {
  it("keeps seeded campaign counts and blocking unchanged after 100 matching submissions", async () => {
    const before = listCampaigns().map((campaign) => ({ ...campaign }));
    const target = before[0];
    const pendingBefore = pendingDemoReportCount();

    for (let index = 0; index < 100; index += 1) {
      const response = await postReport({ ...validReport, signature: target.signature });
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({
        status: "pending_review",
        mode: "demo",
        message: "Queued for review. A single report never blocks a sender on its own.",
      });
    }

    expect(listCampaigns()).toEqual(before);
    expect(listCampaigns().every((campaign) => campaign.blocking === false)).toBe(true);
    expect(pendingDemoReportCount()).toBe(pendingBefore + 100);
  });

  it("does not expose unreviewed reports through public lookup", async () => {
    const signature = signatureOf("A unique unreviewed campaign report for lookup isolation.");
    expect(lookup(signature)).toBeNull();

    const response = await postReport({ ...validReport, signature });
    expect(response.status).toBe(202);
    expect(lookup(signature)).toBeNull();

    const publicLookup = await GET(new Request(
      `http://localhost/api/campaigns?signature=${signature}`,
    ));
    expect(await publicLookup.json()).toEqual({ match: null });
  });

  it("rejects malformed, invalid, and extra sensitive fields without enqueueing", async () => {
    const pendingBefore = pendingDemoReportCount();
    const invalidBodies = [
      null,
      [],
      { ...validReport, signature: "not-a-signature" },
      { ...validReport, stage: "unknown" },
      { ...validReport, tier: "unknown" },
      { ...validReport, family: "free text" },
      { ...validReport, message: "raw message text" },
      { ...validReport, otp: "123456" },
    ];

    for (const body of invalidBodies) {
      expect((await postReport(body)).status).toBe(400);
    }

    const malformed = await POST(new Request("http://localhost/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));
    expect(malformed.status).toBe(400);
    expect(pendingDemoReportCount()).toBe(pendingBefore);
  });

  it("loads only non-blocking campaigns explicitly marked as simulated fixtures", () => {
    const campaigns = listCampaigns();
    expect(campaigns).toHaveLength(5);
    expect(campaigns.every((campaign) => campaign.source === "simulated_fixture")).toBe(true);
    expect(campaigns.every((campaign) => campaign.blocking === false)).toBe(true);
    expect(campaigns.some((campaign) => campaign.reporters > 0)).toBe(true);
  });
});