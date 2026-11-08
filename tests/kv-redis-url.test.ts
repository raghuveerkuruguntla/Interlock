/**
 * The REDIS_URL backend, against a stand-in for the `redis` client that keeps
 * data in memory with the same command semantics this store relies on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string | string[]>();
const ttls = new Map<string, number>();
const connectUrls: string[] = [];

vi.mock("redis", () => ({
  createClient: ({ url }: { url: string }) => ({
    on: () => undefined,
    connect: async () => {
      connectUrls.push(url);
    },
    get: async (k: string) => (typeof store.get(k) === "string" ? (store.get(k) as string) : null),
    set: async (k: string, v: string, o?: { NX?: boolean; EX?: number }) => {
      if (o?.NX && store.has(k)) return null;
      store.set(k, v);
      if (o?.EX) ttls.set(k, o.EX);
      return "OK";
    },
    del: async (keys: string[]) => {
      for (const k of keys) store.delete(k);
      return keys.length;
    },
    rPush: async (k: string, v: string) => {
      const list = (store.get(k) as string[] | undefined) ?? [];
      list.push(v);
      store.set(k, list);
      return list.length;
    },
    lRange: async (k: string, start: number) => ((store.get(k) as string[] | undefined) ?? []).slice(start),
    expire: async (k: string, s: number) => {
      ttls.set(k, s);
      return 1;
    },
  }),
}));

const ENV_KEYS = ["REDIS_URL", "KV_URL", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"];

async function freshKv() {
  vi.resetModules();
  (globalThis as { __interlockKv?: unknown }).__interlockKv = undefined;
  return (await import("@/lib/server/kv")).kv();
}

beforeEach(() => {
  store.clear();
  ttls.clear();
  connectUrls.length = 0;
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  (globalThis as { __interlockKv?: unknown }).__interlockKv = undefined;
});

describe("store selection", () => {
  it("uses a durable Redis connection when only REDIS_URL is set", async () => {
    process.env.REDIS_URL = "rediss://default:secret@example.upstash.io:6379";
    const kv = await freshKv();
    expect(kv.kind).toBe("redis");
    expect(kv.durable).toBe(true);
  });

  it("accepts KV_URL too, and ignores a value that is not a redis URL", async () => {
    process.env.KV_URL = "redis://localhost:6379";
    expect((await freshKv()).kind).toBe("redis");
    delete process.env.KV_URL;
    process.env.REDIS_URL = "not-a-url";
    expect((await freshKv()).kind).toBe("memory");
  });

  it("falls back to memory with nothing configured", async () => {
    expect((await freshKv()).kind).toBe("memory");
  });
});

describe("commands over a REDIS_URL connection", () => {
  it("round-trips values, expiry, set-if-absent, lists and deletes, connecting once", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const kv = await freshKv();

    await kv.set("a", { n: 1 }, 60);
    expect(await kv.get("a")).toEqual({ n: 1 });
    expect(ttls.get("a")).toBe(60);
    expect(await kv.get("missing")).toBeNull();

    expect(await kv.setNx("claim", "first", 30)).toBe(true);
    expect(await kv.setNx("claim", "second")).toBe(false);
    expect(await kv.get("claim")).toBe("first");

    expect(await kv.push("list", { i: 0 }, 120)).toBe(1);
    expect(await kv.push("list", { i: 1 })).toBe(2);
    expect(await kv.range("list", 1)).toEqual([{ i: 1 }]);
    expect(ttls.get("list")).toBe(120);

    await kv.expire("a", 5);
    expect(ttls.get("a")).toBe(5);
    await kv.del("a", "claim");
    expect(await kv.get("a")).toBeNull();

    expect(connectUrls).toEqual(["redis://localhost:6379"]);
  });
});
