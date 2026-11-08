/**
 * Storage for the campaign network.
 *
 * Two backends behind one interface. The in-memory one is the default and is
 * what runs locally; the Redis one is used whenever credentials are present,
 * which is what makes herd immunity survive a serverless instance recycling.
 *
 * The product behaviour is identical either way — which backend is active is
 * surfaced in the UI rather than hidden, because "one report protects the next
 * forty thousand people" is false if the store resets every few minutes.
 */

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { BLOCK_THRESHOLD, type Campaign } from "@/lib/engine/signature";
import type { Stage, Tier } from "@/lib/engine/types";

/** Reports one device may file per hour before it is throttled. */
export const RATE_LIMIT_PER_HOUR = 20;

export interface SeedSpec {
  text: string;
  family: string;
  reports: number;
  reporters: number;
  hoursAgo: number;
}

export interface CampaignBackend {
  readonly kind: "memory" | "redis";
  /** False when reports are lost on restart. Shown in the UI. */
  readonly durable: boolean;
  list(): Promise<Campaign[]>;
  /** Record a report against an existing campaign. Returns the updated record. */
  record(id: string, reporterHash: string, stage: Stage, tier: Tier): Promise<Campaign | null>;
  /** Create a campaign from its first report. */
  create(
    signature: string,
    family: string,
    reporterHash: string,
    stage: Stage,
    tier: Tier,
  ): Promise<Campaign>;
  /** False when this device has filed too many reports this hour. */
  allow(reporterHash: string): Promise<boolean>;
}

/**
 * Hash the device token before it is stored.
 *
 * The token itself is a random value the browser generates and keeps; this is
 * what the server persists. It lets us count one person once and rate-limit
 * them, and it is not reversible into the token, let alone into anything about
 * who they are.
 */
export function hashReporter(token: string): string {
  return createHash("sha256").update(`interlock:${token}`).digest("hex").slice(0, 32);
}

function hourBucket(): number {
  return Math.floor(Date.now() / 3_600_000);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Seeded campaigns carry a synthetic baseline so the demo has something to show
 * on a cold start. Real distinct reporters are counted on top of it, never
 * folded into it — the baseline is fiction and the count is not.
 */
function blocking(reporters: number): boolean {
  return reporters >= BLOCK_THRESHOLD;
}

/* ------------------------------------------------------------------ memory */

export class MemoryBackend implements CampaignBackend {
  readonly kind = "memory" as const;
  readonly durable = false;

  private campaigns = new Map<string, Campaign>();
  private reporters = new Map<string, Set<string>>();
  private baseline = new Map<string, number>();
  private rate = new Map<string, number>();
  private sequence = 0;

  constructor(seeds: SeedSpec[], signatureOf: (text: string) => string) {
    const now = nowSeconds();
    seeds.forEach((seed, i) => {
      const id = `C-${String(i + 1).padStart(4, "0")}`;
      this.sequence = i + 1;
      this.campaigns.set(id, {
        id,
        signature: signatureOf(seed.text),
        family: seed.family,
        firstSeen: now - seed.hoursAgo * 3600,
        lastSeen: now - Math.floor(seed.hoursAgo * 3600 * 0.05),
        reports: seed.reports,
        reporters: seed.reporters,
        topStage: "hook",
        topTier: "high",
        blocking: blocking(seed.reporters),
      });
      this.baseline.set(id, seed.reporters);
      this.reporters.set(id, new Set());
    });
  }

  async list(): Promise<Campaign[]> {
    return [...this.campaigns.values()].sort((a, b) => b.reports - a.reports);
  }

  async record(id: string, reporterHash: string, stage: Stage, tier: Tier): Promise<Campaign | null> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return null;
    const seen = this.reporters.get(id) ?? new Set<string>();
    seen.add(reporterHash);
    this.reporters.set(id, seen);
    campaign.reports += 1;
    campaign.reporters = (this.baseline.get(id) ?? 0) + seen.size;
    campaign.lastSeen = nowSeconds();
    campaign.topStage = stage;
    campaign.topTier = tier;
    campaign.blocking = blocking(campaign.reporters);
    return campaign;
  }

  async create(
    signature: string,
    family: string,
    reporterHash: string,
    stage: Stage,
    tier: Tier,
  ): Promise<Campaign> {
    this.sequence += 1;
    const id = `C-${String(this.sequence).padStart(4, "0")}`;
    const now = nowSeconds();
    const campaign: Campaign = {
      id,
      signature,
      family,
      firstSeen: now,
      lastSeen: now,
      reports: 1,
      reporters: 1,
      topStage: stage,
      topTier: tier,
      // Deliberately false. The first report informs; it never blocks.
      blocking: false,
    };
    this.campaigns.set(id, campaign);
    this.baseline.set(id, 0);
    this.reporters.set(id, new Set([reporterHash]));
    return campaign;
  }

  async allow(reporterHash: string): Promise<boolean> {
    const key = `${reporterHash}:${hourBucket()}`;
    const used = (this.rate.get(key) ?? 0) + 1;
    this.rate.set(key, used);
    return used <= RATE_LIMIT_PER_HOUR;
  }
}

/* ------------------------------------------------------------------- redis */

const K = {
  ids: "il:ids",
  seq: "il:seq",
  seeded: "il:seeded",
  campaign: (id: string) => `il:c:${id}`,
  reporters: (id: string) => `il:r:${id}`,
  rate: (hash: string, hour: number) => `il:rl:${hash}:${hour}`,
};

type RawCampaign = Record<string, string | undefined> & {
  signature?: string;
  family?: string;
  firstSeen?: string;
  lastSeen?: string;
  reports?: string;
  reporterBaseline?: string;
  topStage?: string;
  topTier?: string;
};

export class RedisBackend implements CampaignBackend {
  readonly kind = "redis" as const;
  readonly durable = true;

  private seeding: Promise<void> | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly seeds: SeedSpec[],
    private readonly signatureOf: (text: string) => string,
  ) {}

  /**
   * Seed once, ever.
   *
   * `SET … NX` is the guard: whichever instance wins writes the seeds, and the
   * others skip straight past. Without it, two cold starts at the same moment
   * would both seed, and because the ids are positional the second would
   * overwrite the first mid-read.
   */
  private async ensureSeeded(): Promise<void> {
    if (!this.seeding) {
      this.seeding = (async () => {
        const won = await this.redis.set(K.seeded, "1", { nx: true });
        if (!won) return;
        const now = nowSeconds();
        for (let i = 0; i < this.seeds.length; i += 1) {
          const seed = this.seeds[i];
          const id = `C-${String(i + 1).padStart(4, "0")}`;
          await this.redis.hset(K.campaign(id), {
            signature: this.signatureOf(seed.text),
            family: seed.family,
            firstSeen: String(now - seed.hoursAgo * 3600),
            lastSeen: String(now - Math.floor(seed.hoursAgo * 3600 * 0.05)),
            reports: String(seed.reports),
            reporterBaseline: String(seed.reporters),
            topStage: "hook",
            topTier: "high",
          });
          await this.redis.sadd(K.ids, id);
        }
        await this.redis.set(K.seq, String(this.seeds.length));
      })().catch((err) => {
        // Never let a seeding failure poison the cached promise — the next
        // request should be able to try again.
        this.seeding = null;
        throw err;
      });
    }
    return this.seeding;
  }

  private async hydrate(id: string): Promise<Campaign | null> {
    const [raw, distinct] = await Promise.all([
      this.redis.hgetall<RawCampaign>(K.campaign(id)),
      this.redis.scard(K.reporters(id)),
    ]);
    if (!raw || !raw.signature) return null;
    const reporters = Number(raw.reporterBaseline ?? 0) + (distinct ?? 0);
    return {
      id,
      signature: raw.signature,
      family: raw.family ?? "Other",
      firstSeen: Number(raw.firstSeen ?? 0),
      lastSeen: Number(raw.lastSeen ?? 0),
      reports: Number(raw.reports ?? 0),
      reporters,
      topStage: (raw.topStage ?? "hook") as Stage,
      topTier: (raw.topTier ?? "high") as Tier,
      blocking: blocking(reporters),
    };
  }

  async list(): Promise<Campaign[]> {
    await this.ensureSeeded();
    const ids = await this.redis.smembers(K.ids);
    const campaigns = await Promise.all(ids.map((id) => this.hydrate(id)));
    return campaigns
      .filter((c): c is Campaign => c !== null)
      .sort((a, b) => b.reports - a.reports);
  }

  async record(id: string, reporterHash: string, stage: Stage, tier: Tier): Promise<Campaign | null> {
    // HINCRBY and SADD are both atomic, so two instances recording the same
    // campaign at the same moment cannot lose a count between a read and a
    // write — which a read-modify-write of a JSON blob would.
    await Promise.all([
      this.redis.hincrby(K.campaign(id), "reports", 1),
      this.redis.sadd(K.reporters(id), reporterHash),
      this.redis.hset(K.campaign(id), {
        lastSeen: String(nowSeconds()),
        topStage: stage,
        topTier: tier,
      }),
    ]);
    return this.hydrate(id);
  }

  async create(
    signature: string,
    family: string,
    reporterHash: string,
    stage: Stage,
    tier: Tier,
  ): Promise<Campaign> {
    await this.ensureSeeded();
    const next = await this.redis.incr(K.seq);
    const id = `C-${String(next).padStart(4, "0")}`;
    const now = nowSeconds();
    await this.redis.hset(K.campaign(id), {
      signature,
      family,
      firstSeen: String(now),
      lastSeen: String(now),
      reports: "1",
      reporterBaseline: "0",
      topStage: stage,
      topTier: tier,
    });
    await Promise.all([
      this.redis.sadd(K.ids, id),
      this.redis.sadd(K.reporters(id), reporterHash),
    ]);
    return {
      id,
      signature,
      family,
      firstSeen: now,
      lastSeen: now,
      reports: 1,
      reporters: 1,
      topStage: stage,
      topTier: tier,
      blocking: false,
    };
  }

  async allow(reporterHash: string): Promise<boolean> {
    const key = K.rate(reporterHash, hourBucket());
    const used = await this.redis.incr(key);
    // Expire slightly past the hour so a counter cannot outlive its window.
    if (used === 1) await this.redis.expire(key, 3700);
    return used <= RATE_LIMIT_PER_HOUR;
  }
}

/* --------------------------------------------------------------- selection */

/**
 * Pick a backend from the environment.
 *
 * Supports both the variable names Upstash uses directly and the ones Vercel's
 * marketplace integration injects, so connecting the integration in the
 * dashboard is all that is required — no code change, no redeploy config.
 */
export function createBackend(
  seeds: SeedSpec[],
  signatureOf: (text: string) => string,
): CampaignBackend {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL ??
    process.env.REDIS_REST_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    process.env.REDIS_REST_TOKEN;

  if (!url || !token) return new MemoryBackend(seeds, signatureOf);

  const redis = new Redis({
    url,
    token,
    // The client otherwise tries to JSON.parse every value it reads back. A
    // campaign signature is 16 hex characters, and one that happens to be all
    // digits would parse as a number and lose precision — silently corrupting
    // the thing the whole matching scheme depends on.
    automaticDeserialization: false,
  });

  return new RedisBackend(redis, seeds, signatureOf);
}
