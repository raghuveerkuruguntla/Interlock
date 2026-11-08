import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isKnownNumber,
  maskNumber,
  signatureMatches,
  twilioSignature,
  xmlEscape,
} from "@/lib/server/twilio";

describe("twilio webhook signature", () => {
  const url = "https://example.test/api/twilio/voice";
  const params = { To: "+15125550100", CallSid: "CA123", From: "+15125550147" };

  it("signs the URL followed by params sorted by name", () => {
    const manual = createHmac("sha1", "token")
      .update(`${url}CallSidCA123From+15125550147To+15125550100`)
      .digest("base64");
    expect(twilioSignature("token", url, params)).toBe(manual);
  });

  it("accepts a valid signature on any candidate URL and rejects everything else", () => {
    const sig = twilioSignature("token", url, params);
    expect(signatureMatches("token", ["https://other/x", url], params, sig)).toBe(true);
    expect(signatureMatches("wrong", [url], params, sig)).toBe(false);
    expect(signatureMatches("token", [url], { ...params, From: "+1999" }, sig)).toBe(false);
    expect(signatureMatches("token", [url], params, null)).toBe(false);
  });
});

describe("numbers", () => {
  it("never shows a full number", () => {
    expect(maskNumber("+1 (512) 555-0147")).toBe("•••• 47");
  });
  it("treats configured numbers as saved contacts regardless of format", () => {
    process.env.INTERLOCK_KNOWN_NUMBERS = "+1 512 555 0147, 5125550199";
    expect(isKnownNumber("+15125550147")).toBe(true);
    expect(isKnownNumber("(512) 555-0199")).toBe(true);
    expect(isKnownNumber("+15125550000")).toBe(false);
    delete process.env.INTERLOCK_KNOWN_NUMBERS;
  });
  it("escapes TwiML", () => {
    expect(xmlEscape(`a&b<"c">`)).toBe("a&amp;b&lt;&quot;c&quot;&gt;");
  });
});
