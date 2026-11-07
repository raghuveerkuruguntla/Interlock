/**
 * Campaign signatures: herd immunity without disclosure.
 *
 * One person reports a message. Everyone else targeted by the same campaign in
 * the next ten minutes gets a hard block. The product becomes an immune system
 * rather than a filter — and that only works if the thing that propagates is
 * useless to anyone who intercepts it.
 *
 * What crosses the privacy boundary is this and nothing else:
 *   - a 64-bit SimHash over the normalised campaign template
 *   - the stage label and risk tier
 *   - a coarse timestamp bucket
 *
 * Message text, contact names, call audio and thread content never cross. A
 * SimHash is not reversible: it is a 64-bit projection of a bag of token
 * hashes, so an enormous number of different messages map to any given value
 * and the original cannot be reconstructed from it.
 *
 * The matching property that makes it useful is that *near-identical* inputs
 * produce *near-identical* hashes, so a campaign that varies the victim's name
 * and a short link still clusters, while an unrelated message does not.
 */

import { campaignTemplate } from "./normalize";
import type { Stage, Tier } from "./types";

const MASK64 = (1n << 64n) - 1n;

/** FNV-1a, 64-bit. Fast, dependency-free, and good enough to seed SimHash bits. */
function fnv1a64(input: string): bigint {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * 0x100000001b3n) & MASK64;
  }
  return hash;
}

function shingles(template: string): string[] {
  const tokens = template.split(" ").filter(Boolean);
  if (tokens.length === 0) return [];
  if (tokens.length < 3) return tokens;
  // Overlapping trigrams: resilient to a token being inserted or dropped,
  // which is what per-victim personalisation actually does to a template.
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - 3; i += 1) {
    out.push(tokens.slice(i, i + 3).join(" "));
  }
  return out;
}

/**
 * 64-bit SimHash over template trigrams.
 *
 * Each shingle votes on each of 64 bits; the sign of the summed votes becomes
 * the output bit. Two documents sharing most shingles agree on most bits.
 */
export function simhash64(text: string): bigint {
  const grams = shingles(campaignTemplate(text));
  if (grams.length === 0) return 0n;

  const votes = new Array<number>(64).fill(0);
  for (const gram of grams) {
    const h = fnv1a64(gram);
    for (let bit = 0; bit < 64; bit += 1) {
      votes[bit] += (h >> BigInt(bit)) & 1n ? 1 : -1;
    }
  }

  let out = 0n;
  for (let bit = 0; bit < 64; bit += 1) {
    if (votes[bit] > 0) out |= 1n << BigInt(bit);
  }
  return out;
}

/** Hex form, for transport and display. This is the only message-derived value that ever leaves the device. */
export function signatureOf(text: string): string {
  return simhash64(text).toString(16).padStart(16, "0");
}

export function hammingDistance(a: string, b: string): number {
  let x = (BigInt(`0x${a}`) ^ BigInt(`0x${b}`)) & MASK64;
  let bits = 0;
  while (x) {
    x &= x - 1n;
    bits += 1;
  }
  return bits;
}

/**
 * Two signatures within this many bits are treated as the same campaign.
 *
 * Chosen rather than tuned: at 64 bits, a distance of 3 is roughly a 95%+
 * shingle overlap, which personalisation survives and an unrelated message
 * essentially never reaches by chance.
 */
export const CAMPAIGN_RADIUS = 3;

export interface CampaignReport {
  signature: string;
  stage: Stage;
  tier: Tier;
  /** Coarse bucket — hour resolution. Deliberately not a precise timestamp. */
  hourBucket: number;
  /** Family label chosen by the reporter from a fixed list, never free text. */
  family: string;
}

export interface Campaign {
  id: string;
  signature: string;
  family: string;
  firstSeen: number;
  lastSeen: number;
  reports: number;
  /** Distinct reporters. Used for reputation weighting before a hard block. */
  reporters: number;
  topStage: Stage;
  topTier: Tier;
  /**
   * A campaign only hard-blocks once enough independent reports arrive.
   * Until then it informs. This is the defence against someone using the
   * report button as a denial-of-service weapon against a real business.
   */
  blocking: boolean;
}

export interface CampaignMatch {
  campaign: Campaign;
  distance: number;
  /** Rough confidence from bit distance alone. Not a probability of fraud. */
  confidence: number;
}

export function matchCampaign(
  signature: string,
  campaigns: Campaign[],
  radius = CAMPAIGN_RADIUS,
): CampaignMatch | null {
  let best: CampaignMatch | null = null;
  for (const campaign of campaigns) {
    const distance = hammingDistance(signature, campaign.signature);
    if (distance > radius) continue;
    const confidence = 1 - distance / (radius + 1);
    if (!best || distance < best.distance) best = { campaign, distance, confidence };
  }
  return best;
}

/**
 * Reports needed before a campaign blocks rather than informs.
 *
 * A system where one report blocks a sender is a weapon pointed at legitimate
 * businesses. Naming that yourself, before someone else does, is worth more
 * than the feature.
 */
export const BLOCK_THRESHOLD = 3;
