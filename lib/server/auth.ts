/**
 * Authentication primitives. No third-party auth service, no dependency.
 *
 * Passwords are hashed with scrypt and a per-user salt and compared in
 * constant time. A session is a signed, expiring token in an httpOnly,
 * SameSite=Lax cookie — the browser's JavaScript can never read it, and a
 * tampered or expired token is rejected before any account lookup happens.
 *
 * The signing key is AUTH_SECRET. Without it, a random per-process key is used
 * so local development works, and the UI says that sessions will not survive
 * a restart. Deployments must set AUTH_SECRET.
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "il_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const globalForAuth = globalThis as unknown as { __interlockDevSecret?: string };

export function authSecretConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);
}

function secret(): string {
  if (authSecretConfigured()) return process.env.AUTH_SECRET as string;
  if (!globalForAuth.__interlockDevSecret) {
    globalForAuth.__interlockDevSecret = randomBytes(32).toString("hex");
  }
  return globalForAuth.__interlockDevSecret;
}

/* --------------------------------------------------------------- passwords */

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  const derived = scryptSync(password.normalize("NFKC"), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password.normalize("NFKC"), salt, 64);
  const want = Buffer.from(expected, "hex");
  return want.length === actual.length && timingSafeEqual(want, actual);
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Enter a password.";
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 200) return "That password is too long.";
  return null;
}

export function normaliseEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e) ? e : null;
}

/* ---------------------------------------------------------------- sessions */

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, now = Date.now()): string {
  const payload = b64url(JSON.stringify({ u: userId, e: Math.floor(now / 1000) + SESSION_TTL_SECONDS }));
  return `${payload}.${sign(payload)}`;
}

/** Returns the user id, or null for a missing, tampered or expired token. */
export function readSessionToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u?: unknown; e?: unknown };
    if (typeof data.u !== "string" || typeof data.e !== "number") return null;
    if (data.e * 1000 < now) return null;
    return data.u;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
