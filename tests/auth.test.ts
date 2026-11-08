import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  hashPassword,
  normaliseEmail,
  readSessionToken,
  SESSION_TTL_SECONDS,
  validatePassword,
  verifyPassword,
} from "@/lib/server/auth";

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", () => {
    const h = hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("correct horse battery", h)).toBe(true);
    expect(verifyPassword("correct horse batterz", h)).toBe(false);
  });
  it("salts every hash", () => {
    expect(hashPassword("same password!")).not.toBe(hashPassword("same password!"));
  });
  it("enforces a minimum length", () => {
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("long enough pw")).toBeNull();
  });
  it("normalises email", () => {
    expect(normaliseEmail("  Pat@Example.COM ")).toBe("pat@example.com");
    expect(normaliseEmail("not an email")).toBeNull();
  });
});

describe("session tokens", () => {
  it("round-trips", () => {
    expect(readSessionToken(createSessionToken("user-1"))).toBe("user-1");
  });
  it("rejects tampering", () => {
    const t = createSessionToken("user-1");
    const [payload, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "admin", e: 9_999_999_999 })).toString("base64url");
    expect(readSessionToken(`${forged}.${sig}`)).toBeNull();
    expect(readSessionToken(`${payload}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(readSessionToken("garbage")).toBeNull();
  });
  it("expires", () => {
    const t = createSessionToken("user-1", 0);
    expect(readSessionToken(t, (SESSION_TTL_SECONDS + 1) * 1000)).toBeNull();
  });
});
