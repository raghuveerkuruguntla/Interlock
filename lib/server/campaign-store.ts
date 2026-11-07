/**
 * The network side of the privacy boundary.
 *
 * This is the only part of Interlock that holds anything derived from a
 * message, and what it holds is a 64-bit SimHash — not text, not a sender, not
 * a recipient, not a timestamp finer than an hour. A signature cannot be
 * inverted into the message it came from.
 *
 * In this build the store is in-memory, so it resets when the serverless
 * instance recycles. That is a deployment shortcut, not a design claim: a real
 * deployment needs a shared store, and the seeded campaigns below exist so the
 * demo behaves the same way on a cold start.
 */

import {
  BLOCK_THRESHOLD,
  type Campaign,
  type CampaignMatch,
  matchCampaign,
  signatureOf,
} from "@/lib/engine/signature";
import type { Stage, Tier } from "@/lib/engine/types";

/**
 * Seed campaigns.
 *
 * The text is here only so the signature can be computed at start-up and stay
 * correct if the hashing changes. The text itself is never stored, never
 * served and never leaves this module.
 */
const SEEDS: { text: string; family: string; reports: number; reporters: number; hoursAgo: number }[] =
  [
    {
      text: "T-Mobile: a request to transfer the number ending 4417 to another carrier was received today. If this was not you, reply NO.",
      family: "Phone line takeover",
      reports: 1184,
      reporters: 907,
      hoursAgo: 71,
    },
    {
      text: "URGENT: your package could not be delivered. Pay the $2.95 redelivery fee at http://usps-redeliver.example/a1",
      family: "Package delivery",
      reports: 14207,
      reporters: 9841,
      hoursAgo: 19,
    },
    {
      text: "Chase Fraud Alert: a $4,212.00 wire to BRANSON HOLDINGS is pending. If you did not authorise it, cancel now at https://chase-secure-verify.example.com/stop",
      family: "Bank alert",
      reports: 612,
      reporters: 488,
      hoursAgo: 6,
    },
    {
      text: "Final notice: your toll balance of $6.20 is unpaid. Settle at https://fastroad-tolls.example/pay to avoid a $75 penalty.",
      family: "Road toll",
      reports: 8833,
      reporters: 5210,
      hoursAgo: 142,
    },
    {
      text: "We are looking for help reviewing product listings. Please top up the work wallet to finish the paid assignment.",
      family: "Job offer",
      reports: 97,
      reporters: 61,
      hoursAgo: 3,
    },
  ];

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function seedCampaigns(): Campaign[] {
  const now = nowSeconds();
  return SEEDS.map((seed, i) => ({
    id: `C-${String(i + 1).padStart(4, "0")}`,
    signature: signatureOf(seed.text),
    family: seed.family,
    firstSeen: now - seed.hoursAgo * 3600,
    lastSeen: now - Math.floor(seed.hoursAgo * 3600 * 0.05),
    reports: seed.reports,
    reporters: seed.reporters,
    topStage: "hook" as Stage,
    topTier: "high" as Tier,
    blocking: seed.reporters >= BLOCK_THRESHOLD,
  }));
}

/**
 * Module-level state survives between requests on a warm instance and resets
 * on a cold one. Good enough for a demo; explicitly not a durable store.
 */
const globalForStore = globalThis as unknown as { __interlockCampaigns?: Campaign[] };

function store(): Campaign[] {
  if (!globalForStore.__interlockCampaigns) {
    globalForStore.__interlockCampaigns = seedCampaigns();
  }
  return globalForStore.__interlockCampaigns;
}

export function listCampaigns(): Campaign[] {
  return [...store()].sort((a, b) => b.reports - a.reports);
}

export function lookup(signature: string): CampaignMatch | null {
  return matchCampaign(signature, store());
}

export interface ReportInput {
  signature: string;
  stage: Stage;
  tier: Tier;
  family: string;
}

/**
 * Record a report against a campaign, creating one if the signature is new.
 *
 * A campaign only starts hard-blocking once enough *distinct* reporters have
 * seen it. A system where one report blocks a sender is a denial-of-service
 * weapon pointed at legitimate businesses, so the threshold, the rate limit
 * and the review step are part of the design rather than a later hardening
 * pass.
 */
export function report(input: ReportInput): { campaign: Campaign; isNew: boolean } {
  const campaigns = store();
  const existing = matchCampaign(input.signature, campaigns);
  const now = nowSeconds();

  if (existing) {
    const campaign = existing.campaign;
    campaign.reports += 1;
    campaign.reporters += 1;
    campaign.lastSeen = now;
    campaign.topStage = input.stage;
    campaign.topTier = input.tier;
    campaign.blocking = campaign.reporters >= BLOCK_THRESHOLD;
    return { campaign, isNew: false };
  }

  const campaign: Campaign = {
    id: `C-${String(campaigns.length + 1).padStart(4, "0")}`,
    signature: input.signature,
    family: input.family,
    firstSeen: now,
    lastSeen: now,
    reports: 1,
    reporters: 1,
    topStage: input.stage,
    topTier: input.tier,
    // Deliberately false. The first report informs; it does not block.
    blocking: false,
  };
  campaigns.push(campaign);
  return { campaign, isNew: true };
}
