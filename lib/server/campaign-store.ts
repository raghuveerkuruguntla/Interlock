/**
 * The network side of the privacy boundary.
 *
 * The demo queue stores only a 64-bit SimHash and fixed labels, never message
 * text, card details, OTP values or conversation histories. SimHash is not a
 * cryptographic privacy guarantee and may permit dictionary-based inference.
 *
 * In this build the store is in-memory, so it resets when the serverless
 * instance recycles. Submissions are unverified demo reports and never change
 * the separate simulated fixture campaigns below. Durable authenticated
 * reporting and moderation are deferred to the SpacetimeDB integration.
 */

import {
  type Campaign,
  type CampaignMatch,
  matchCampaign,
  signatureOf,
} from "@/lib/engine/signature";
import type { Stage, Tier } from "@/lib/engine/types";

/**
 * Simulated campaign fixtures. Their counts are examples, not verified users.
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
    source: "simulated_fixture",
    signature: signatureOf(seed.text),
    family: seed.family,
    firstSeen: now - seed.hoursAgo * 3600,
    lastSeen: now - Math.floor(seed.hoursAgo * 3600 * 0.05),
    reports: seed.reports,
    reporters: seed.reporters,
    topStage: "hook" as Stage,
    topTier: "high" as Tier,
    blocking: false,
  }));
}

/**
 * Module-level state survives between requests on a warm instance and resets
 * on a cold one. Good enough for a demo; explicitly not a durable store.
 */
const globalForStore = globalThis as unknown as {
  __interlockCampaigns?: Campaign[];
  __interlockPendingDemoReports?: ReportInput[];
};

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

function pendingDemoReports(): ReportInput[] {
  if (!globalForStore.__interlockPendingDemoReports) {
    globalForStore.__interlockPendingDemoReports = [];
  }
  return globalForStore.__interlockPendingDemoReports;
}

/** Enqueue minimal, unverified data for simulated review; never alter campaigns. */
export function enqueueDemoReport(input: ReportInput): void {
  pendingDemoReports().push({ ...input });
}

export function pendingDemoReportCount(): number {
  return pendingDemoReports().length;
}
