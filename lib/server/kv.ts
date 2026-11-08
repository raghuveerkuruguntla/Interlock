/**
 * A small key-value store for accounts and live sessions.
 *
 * Same selection rule as the campaign network: Redis (Upstash, or Vercel's
 * marketplace integration) whenever credentials are present, an in-process map
 * otherwise. The in-process map is fine on a laptop and on a single dev server,
 * but on serverless hosting each instance has its own — so a Twilio webhook and
 * the browser polling for transcript segments could land on different ones.
 * Which backend is active is surfaced to the UI rather than hidden.
 */

import { Redis } from "@upstash/redis";
import { createClient, type RedisClientType } from "redis";

export interface Kv {
  readonly kind: "memory" | "redis";
  readonly durable: boolean;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  /** Set only if absent. Returns true when this call wrote the value. */
  setNx<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  /** Append to a list. Returns the new length. */
  push<T>(key: string, value: T, ttlSeconds?: number): Promise<number>;
  /** Items from `start` (inclusive) to the end. */
  range<T>(key: string, start: number): Promise<T[]>;
  expire(key: string, ttlSeconds: number): Promise<void>;
}

/* ------------------------------------------------------------------ memory */

class MemoryKv implements Kv {
  readonly kind = "memory" as const;
  readonly durable = false;
  private values = new Map<string, { v: string; exp: number | null }>();
  private lists = new Map<string, { v: string[]; exp: number | null }>();

  private alive<E extends { exp: number | null }>(map: Map<string, E>, key: string): E | null {
    const entry = map.get(key);
    if (!entry) return null;
    if (entry.exp !== null && entry.exp <= Date.now()) {
      map.delete(key);
      return null;
    }
    return entry;
  }

  private exp(ttl?: number): number | null {
    return ttl ? Date.now() + ttl * 1000 : null;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.alive(this.values, key);
    return entry ? (JSON.parse(entry.v) as T) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.values.set(key, { v: JSON.stringify(value), exp: this.exp(ttl) });
  }

  async setNx<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (this.alive(this.values, key)) return false;
    await this.set(key, value, ttl);
    return true;
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.values.delete(key);
      this.lists.delete(key);
    }
  }

  async push<T>(key: string, value: T, ttl?: number): Promise<number> {
    const entry = this.alive(this.lists, key) ?? { v: [], exp: null };
    entry.v.push(JSON.stringify(value));
    if (ttl) entry.exp = this.exp(ttl);
    this.lists.set(key, entry);
    return entry.v.length;
  }

  async range<T>(key: string, start: number): Promise<T[]> {
    const entry = this.alive(this.lists, key);
    return entry ? entry.v.slice(Math.max(0, start)).map((x) => JSON.parse(x) as T) : [];
  }

  async expire(key: string, ttl: number): Promise<void> {
    const v = this.alive(this.values, key);
    if (v) v.exp = this.exp(ttl);
    const l = this.alive(this.lists, key);
    if (l) l.exp = this.exp(ttl);
  }
}

/* ------------------------------------------------------------------- redis */

class RedisKv implements Kv {
  readonly kind = "redis" as const;
  readonly durable = true;
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get<string>(key);
    return raw == null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (ttl) await this.redis.set(key, raw, { ex: ttl });
    else await this.redis.set(key, raw);
  }

  async setNx<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const raw = JSON.stringify(value);
    const won = ttl
      ? await this.redis.set(key, raw, { nx: true, ex: ttl })
      : await this.redis.set(key, raw, { nx: true });
    return Boolean(won);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.redis.del(...keys);
  }

  async push<T>(key: string, value: T, ttl?: number): Promise<number> {
    const n = await this.redis.rpush(key, JSON.stringify(value));
    if (ttl) await this.redis.expire(key, ttl);
    return n;
  }

  async range<T>(key: string, start: number): Promise<T[]> {
    const raw = await this.redis.lrange<string>(key, Math.max(0, start), -1);
    return raw.map((x) => JSON.parse(x) as T);
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.redis.expire(key, ttl);
  }
}

/* ------------------------------------------------------- redis (TCP / URL) */

/**
 * A standard Redis connection from a `redis://` or `rediss://` URL — what
 * Vercel's Redis integration provides as REDIS_URL. One connection per server
 * instance, opened on first use and reused; if it drops, the next call
 * reconnects.
 */
class RedisUrlKv implements Kv {
  readonly kind = "redis" as const;
  readonly durable = true;
  private connecting: Promise<RedisClientType> | null = null;

  constructor(private readonly url: string) {}

  private client(): Promise<RedisClientType> {
    if (!this.connecting) {
      const client: RedisClientType = createClient({
        url: this.url,
        socket: { connectTimeout: 5_000, reconnectStrategy: (retries) => Math.min(retries * 200, 2_000) },
      });
      // Without a listener, a dropped connection would crash the process.
      client.on("error", (err: unknown) => console.error("Redis connection error", err));
      this.connecting = client.connect().then(() => client).catch((err: unknown) => {
        // Let the next call try again rather than caching a failed connection.
        this.connecting = null;
        throw err;
      });
    }
    return this.connecting;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await (await this.client()).get(key);
    return raw == null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const c = await this.client();
    const raw = JSON.stringify(value);
    if (ttl) await c.set(key, raw, { EX: ttl });
    else await c.set(key, raw);
  }

  async setNx<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const c = await this.client();
    const raw = JSON.stringify(value);
    const won = ttl ? await c.set(key, raw, { NX: true, EX: ttl }) : await c.set(key, raw, { NX: true });
    return won === "OK";
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await (await this.client()).del(keys);
  }

  async push<T>(key: string, value: T, ttl?: number): Promise<number> {
    const c = await this.client();
    const n = await c.rPush(key, JSON.stringify(value));
    if (ttl) await c.expire(key, ttl);
    return n;
  }

  async range<T>(key: string, start: number): Promise<T[]> {
    const raw = await (await this.client()).lRange(key, Math.max(0, start), -1);
    return raw.map((x) => JSON.parse(x) as T);
  }

  async expire(key: string, ttl: number): Promise<void> {
    await (await this.client()).expire(key, ttl);
  }
}

/* --------------------------------------------------------------- selection */

const globalForKv = globalThis as unknown as { __interlockKv?: Kv };

/**
 * Upstash's REST API if its variables are set, otherwise a Redis URL
 * (REDIS_URL from Vercel's Redis integration, or KV_URL), otherwise memory.
 */
export function kv(): Kv {
  if (globalForKv.__interlockKv) return globalForKv.__interlockKv;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? process.env.REDIS_REST_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    process.env.REDIS_REST_TOKEN;
  const redisUrl = (process.env.REDIS_URL ?? process.env.KV_URL)?.trim();
  globalForKv.__interlockKv =
    url && token
      ? new RedisKv(new Redis({ url, token, automaticDeserialization: false }))
      : redisUrl && /^rediss?:\/\//.test(redisUrl)
        ? new RedisUrlKv(redisUrl)
        : new MemoryKv();
  return globalForKv.__interlockKv;
}

/** For tests: swap in a fresh in-memory store. */
export function resetMemoryKv(): void {
  globalForKv.__interlockKv = new MemoryKv();
}
