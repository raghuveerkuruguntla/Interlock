import { afterEach, describe, expect, it } from "vitest";
import { callMode, conferenceName, customerPhone, isCustomerNumber, voiceTwiml } from "@/lib/server/twilio-voice";

const base = "https://interlock.test";
const sessionId = "3f2b2d4e-1111-4222-8333-944455556666";

afterEach(() => {
  delete process.env.INTERLOCK_CALL_MODE;
  delete process.env.INTERLOCK_CUSTOMER_PHONE;
  delete process.env.INTERLOCK_FORWARD_TO;
});

describe("call mode and customer phone", () => {
  it("defaults to conference, which works on a Twilio trial", () => {
    expect(callMode()).toBe("conference");
    process.env.INTERLOCK_CALL_MODE = "forward";
    expect(callMode()).toBe("forward");
  });

  it("recognises the customer's phone in any format, with the older variable name as fallback", () => {
    process.env.INTERLOCK_FORWARD_TO = "+1 (512) 555-0111";
    expect(customerPhone()).toBe("+1 (512) 555-0111");
    expect(isCustomerNumber("+15125550111")).toBe(true);
    expect(isCustomerNumber("+15125550147")).toBe(false);
    process.env.INTERLOCK_CUSTOMER_PHONE = "+15125550199";
    expect(isCustomerNumber("5125550199")).toBe(true);
  });

  it("treats nobody as the customer when no phone is configured", () => {
    expect(isCustomerNumber("+15125550111")).toBe(false);
  });
});

describe("conference mode", () => {
  it("joins both people to the session's private conference, transcribing each on its own track", () => {
    for (const role of ["caller", "customer"] as const) {
      const xml = voiceTwiml({ mode: "conference", sessionId, base, role, analyse: true });
      expect(xml).toContain(`<Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">${conferenceName(sessionId)}</Conference>`);
      expect(xml).toContain('track="inbound_track"');
      expect(xml).toContain(`speaker=${role}`);
      expect(xml).not.toContain("<Number>");
    }
  });

  it("gives the other person the consent notice and the customer a short confirmation", () => {
    expect(voiceTwiml({ mode: "conference", sessionId, base, role: "caller", analyse: true })).toMatch(/with their consent, this call is transcribed live/i);
    expect(voiceTwiml({ mode: "conference", sessionId, base, role: "customer", analyse: true })).toMatch(/live protection is on/i);
  });

  it("connects a saved contact without transcribing", () => {
    const xml = voiceTwiml({ mode: "conference", sessionId, base, role: "caller", analyse: false });
    expect(xml).toContain("<Conference");
    expect(xml).not.toContain("<Transcription");
  });

  it("hangs up when no session is armed, analysing nothing", () => {
    const xml = voiceTwiml({ mode: "conference", base, role: "caller", analyse: false });
    expect(xml).toContain("<Hangup/>");
    expect(xml).not.toContain("<Transcription");
  });
});

describe("forward mode", () => {
  it("forwards to the customer and transcribes both tracks", () => {
    const xml = voiceTwiml({ mode: "forward", sessionId, base, role: "caller", analyse: true, customerPhone: "+15125550111" });
    expect(xml).toContain('track="both_tracks"');
    expect(xml).toContain(">+15125550111</Dial>");
  });

  it("forwards without analysis when nothing is armed, and refuses with no number configured", () => {
    expect(voiceTwiml({ mode: "forward", base, role: "caller", analyse: false, customerPhone: "+15125550111" }))
      .toBe('<Dial answerOnBridge="true">+15125550111</Dial>');
    expect(voiceTwiml({ mode: "forward", base, role: "caller", analyse: false })).toContain("<Hangup/>");
  });
});
