"use client";

/**
 * Onboarding is the consent conversation, not a terms-of-service wall.
 *
 * Step one says exactly what Interlock can and cannot see. Step two asks for
 * each permission separately, all starting OFF. Nothing is saved until the
 * customer presses the final button, and choosing nothing is a valid answer.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/components/account";
import { ConsentToggles } from "@/components/consent-toggles";
import { type ConsentKey, DEFAULT_CONSENT } from "@/lib/account/types";

const CAN = [
  "Turn speech into text during a live session you start, and check it for scam warning signs.",
  "Check messages from numbers that are not in your contacts.",
  "Warn you while it is happening, and explain why in plain words.",
  "Write you a short report afterwards with clear next steps.",
];

const CANNOT = [
  "Listen to your calls without you starting a live session. There is no always-on listening.",
  "Read or hear anything from your saved contacts. People you talk to often can be skipped too.",
  "Record audio, or keep full transcripts. Text is deleted when the session ends.",
  "See your bank, your carrier account, your photos or your location.",
  "Act on your account. Holds and monitoring in this prototype are simulated and labelled that way.",
];

export function OnboardingClient() {
  const router = useRouter();
  const { account, updateConsent } = useAccount();
  const [step, setStep] = useState(1);
  const [choices, setChoices] = useState({
    callAnalysis: DEFAULT_CONSENT.callAnalysis,
    messageAnalysis: DEFAULT_CONSENT.messageAnalysis,
    skipFrequentNumbers: DEFAULT_CONSENT.skipFrequentNumbers,
    networkReporting: DEFAULT_CONSENT.networkReporting,
    saveIncidents: DEFAULT_CONSENT.saveIncidents,
  });
  const [read, setRead] = useState(false);
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    await updateConsent(choices, true);
    setBusy(false);
    router.push("/account");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-10 sm:px-6">
      <p className="text-sm font-medium text-muted">Step {step} of 2</p>
      {step === 1 && (
        <>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {account ? `Hi ${account.user.name.split(" ")[0]}. ` : ""}Here is exactly what Interlock does
          </h1>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <section className="rounded-card border border-line bg-surface p-4">
              <h2 className="font-semibold" style={{ color: "var(--ok)" }}>✓ With your permission, it can</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {CAN.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </section>
            <section className="rounded-card border border-line bg-surface p-4">
              <h2 className="font-semibold" style={{ color: "var(--tier-critical)" }}>✕ It never</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {CANNOT.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </section>
          </div>
          <p className="mt-4 rounded-md bg-surface-2 p-3 text-sm text-muted">
            Why only unknown numbers? Most scam calls and texts come from numbers you have never
            dealt with. Calls from saved contacts and people you talk to often are left alone. A
            caller can fake a familiar number, so this is a privacy choice, not a guarantee.
          </p>
          <label className="mt-5 flex gap-2.5 text-sm">
            <input type="checkbox" className="mt-1" checked={read} onChange={(e) => setRead(e.target.checked)} />
            <span>
              I have read this and the <Link href="/privacy" className="underline" target="_blank">privacy notice</Link>.
            </span>
          </label>
          <button type="button" disabled={!read} onClick={() => setStep(2)} className="mt-4 rounded-md bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-40">
            Continue
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose what to turn on</h1>
          <p className="mt-2 text-muted">
            Everything starts off. Turn on only what you want — you can change any of these, or turn
            everything off, at any time in Privacy, and it takes effect straight away.
          </p>
          <div className="mt-5">
            <ConsentToggles
              value={choices}
              onChange={(key: ConsentKey, v: boolean) => setChoices({ ...choices, [key]: v })}
              busy={busy}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => void finish()} disabled={busy} className="rounded-md bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50">
              {busy ? "Saving…" : "Save my choices"}
            </button>
            <button type="button" onClick={() => setStep(1)} className="rounded-md border border-line px-4 py-2.5">
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
