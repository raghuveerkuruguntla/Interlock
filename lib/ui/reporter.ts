"use client";

/**
 * The device token used for herd-immunity reporting.
 *
 * A random value this browser generates and keeps. It is tied to no account,
 * no phone number and nothing else in the product, and the server stores only
 * its SHA-256 — so it cannot be read back out of the campaign store.
 *
 * It exists because two defences depend on being able to tell one reporter
 * from another: counting distinct reporters, so a campaign only hard-blocks
 * once several independent people have seen it, and rate limiting, so one
 * person cannot manufacture that threshold alone. Without it, the report
 * button is a denial-of-service weapon pointed at legitimate businesses — so
 * the honest trade is to generate the smallest possible identifier and say
 * clearly that it exists.
 *
 * Clearing site data resets it, which costs the user nothing but their report
 * history's continuity.
 */

const KEY = "interlock.reporter.v1";

function generate(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Last resort for an environment with no crypto at all. Weaker, and only
    // ever used for counting — never for authentication or authorisation.
    return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function reporterToken(): string {
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && /^[A-Za-z0-9_-]{8,100}$/.test(existing)) return existing;
    const token = generate();
    window.localStorage.setItem(KEY, token);
    return token;
  } catch {
    // Storage blocked: reporting still works, this device just counts as a new
    // reporter each time rather than being recognised.
    return generate();
  }
}
