"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const FRAMES = [
  {
    index: "01", label: "First contact", phase: "Nothing conclusive yet",
    sender: "T-Mobile: We received a request to transfer the number ending 4417. Reply NO if this wasn't you.",
    reply: "NO",
    detail: "The opening message could be legitimate. Interlock needs more context before making a claim.",
    tone: "neutral" as const,
  },
  {
    index: "02", label: "Isolation", phase: "Warning signs are building",
    sender: "Stay on the call. Don't contact T-Mobile separately — that will delay the cancellation.",
    reply: "Can I verify this myself?",
    detail: "A sender discouraging independent verification is a meaningful signal. Contact the company through a trusted channel.",
    tone: "warning" as const,
  },
  {
    index: "03", label: "Code request", phase: "Your passcode needs protecting",
    sender: "Read me the 6 digits you just received. I need them to stop the transfer.",
    reply: "I just received a code.",
    detail: "A live call plus a request for your passcode is when Interlock holds the code back.",
    tone: "warning" as const,
  },
  {
    index: "04", label: "Account action", phase: "A moment to stop the loss",
    sender: "We have to move your number now or it will be disconnected.",
    reply: "I need to check first.",
    detail: "High-risk account changes get a short cooling-off period, so you have time to check.",
    tone: "warning" as const,
  },
];

export function LandingPreview() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => {
      setStep((current) => (current + 1) % FRAMES.length);
    }, 3400);
    return () => window.clearInterval(interval);
  }, [playing]);
  const pickStep = (next: number) => {
    setStep((next + FRAMES.length) % FRAMES.length);
    setPlaying(false);
  };
  const frame = FRAMES[step];
  return (
    <div className="editorial-preview" aria-label="Illustrative interactive scam conversation">
      <div className="editorial-preview-header">
        <div className="flex items-center gap-2">
          <span className="editorial-preview-signal" />
          <span className="text-xs font-semibold tracking-tight text-ink">A conversation, unfolding.</span>
        </div>
        <button type="button" onClick={() => setPlaying((value) => !value)}
          className="preview-play-toggle" aria-pressed={playing}
          aria-label={playing ? "Pause preview playback" : "Resume preview playback"}>
          <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
          {playing ? "Pause" : "Play"} preview
        </button>
      </div>

      <div className="editorial-preview-main" key={frame.index}>
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>Incoming conversation</span><span className="tabular-nums">{frame.index} / 04</span>
        </div>
        <div className="mt-7 flex items-start gap-3">
          <span className="editorial-avatar" aria-hidden="true">?</span>
          <div className="max-w-[90%]">
            <p className="mb-2 text-xs font-semibold text-muted">Unverified sender</p>
            <p className="editorial-message">{frame.sender}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <div className="max-w-[80%]">
            <p className="mb-2 text-right text-xs font-semibold text-muted">You</p>
            <p className="editorial-reply">{frame.reply}</p>
          </div>
        </div>

        <div className={`editorial-insight ${frame.tone === "warning" ? "editorial-insight-warning" : ""}`}>
          <div className="flex items-center gap-2">
            <span className="editorial-insight-icon" aria-hidden="true">{frame.tone === "warning" ? "!" : "i"}</span>
            <span className="text-xs font-semibold text-ink">{frame.phase}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">{frame.detail}</p>
        </div>
      </div>

      <div className="editorial-preview-bottom">
        <div className="flex items-center justify-between gap-3 text-xs font-medium">
          <span className="text-muted">{frame.label}</span>
          <Link href="/demo" className="text-brand hover:underline">Open live engine ↗</Link>
        </div>
        <div className="mt-4 flex items-center gap-1.5" role="group" aria-label="Choose a story step">
          {FRAMES.map((item, index) => (
            <button key={item.index} type="button" onClick={() => pickStep(index)}
              aria-label={`Show ${item.label}`} aria-pressed={step === index}
              className={`editorial-step-dot ${step === index ? "editorial-step-dot-active" : ""}`} />
          ))}
        </div>
        <div className="mt-5 flex justify-between gap-3">
          <button type="button" disabled={step === 0} onClick={() => pickStep(step - 1)}
            className="editorial-step-button disabled:opacity-35">← Previous</button>
          <button type="button" onClick={() => pickStep(step + 1)}
            className="editorial-step-button editorial-step-next">
            {step === FRAMES.length - 1 ? "Replay preview ↺" : "Next moment →"}
          </button>
        </div>
      </div>
    </div>
  );
}
