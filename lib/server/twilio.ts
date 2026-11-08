/**
 * Twilio webhook plumbing, without the Twilio SDK.
 *
 * Every webhook is verified against `X-Twilio-Signature` before it is allowed
 * to touch a live session. Without that check, anyone who found the URL could
 * post fake "transcript" lines into a customer's live warning screen.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Twilio's scheme: HMAC-SHA1 over the URL followed by each POST param, sorted by name. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

export function signatureMatches(
  authToken: string,
  urls: string[],
  params: Record<string, string>,
  given: string | null,
): boolean {
  if (!given) return false;
  const g = Buffer.from(given);
  return urls.some((url) => {
    const want = Buffer.from(twilioSignature(authToken, url, params));
    return want.length === g.length && timingSafeEqual(want, g);
  });
}

/** The public origin Twilio should call back to. */
export function publicBase(request: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  return `${proto}://${host}`;
}

export type VerifiedForm =
  | { ok: true; params: Record<string, string> }
  | { ok: false; status: number; message: string };

/**
 * Parse and verify a Twilio webhook. Tries both the URL as the server saw it
 * and as reconstructed from the public origin, since a proxy in front of the
 * app can change scheme or host between Twilio and here.
 */
export async function verifiedTwilioForm(request: Request): Promise<VerifiedForm> {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    if (process.env.TWILIO_SKIP_SIGNATURE === "1" && process.env.NODE_ENV !== "production") {
      return { ok: true, params };
    }
    return { ok: false, status: 503, message: "TWILIO_AUTH_TOKEN is not configured." };
  }
  const u = new URL(request.url);
  const candidates = [request.url, `${publicBase(request)}${u.pathname}${u.search}`];
  if (!signatureMatches(token, candidates, params, request.headers.get("x-twilio-signature"))) {
    return { ok: false, status: 403, message: "Bad Twilio signature." };
  }
  return { ok: true, params };
}

export function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[ch]!);
}

export function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "content-type": "text/xml; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Digits only, for comparing numbers regardless of formatting. */
export function digits(n: string | undefined | null): string {
  return (n ?? "").replace(/\D/g, "");
}

/** Never store or show a full phone number. */
export function maskNumber(n: string | undefined | null): string {
  const d = digits(n);
  return d.length >= 4 ? `•••• ${d.slice(-2)}` : "Unknown number";
}

/**
 * The prototype's stand-in for "saved contacts": numbers listed in
 * INTERLOCK_KNOWN_NUMBERS are treated as contacts and never transcribed. A
 * real deployment would check the device's contact list on the device.
 */
export function isKnownNumber(n: string | undefined | null): boolean {
  const want = digits(n).slice(-10);
  if (!want) return false;
  return (process.env.INTERLOCK_KNOWN_NUMBERS ?? "")
    .split(",")
    .map((x) => digits(x).slice(-10))
    .some((x) => x && x === want);
}
