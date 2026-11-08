"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const STAGES = [
  {
    name: "Contact",
    title: "The first message looks harmless.",
    attacker: "A believable notice, a wrong-number opener, or an unfamiliar caller starts the thread.",
    safeguard: "Campaign match",
    response: "Check whether a similar, previously reported pattern exists. One unfamiliar number is not proof of fraud.",
    takeaway: "A message on its own rarely tells the whole story.",
  },
  {
    name: "Hook",
    title: "The story starts to pull you in.",
    attacker: "The sender introduces a deadline, an unexpected benefit, or a problem only they can fix.",
    safeguard: "Grounded warning",
    response: "Explain exactly what was observed and ask a question when evidence is ambiguous.",
    takeaway: "Explain the risk instead of flashing a generic alarm.",
  },
  {
    name: "Isolation",
    title: "They don't want you to check.",
    attacker: "The sender discourages calling the company, asking family, or using a trusted channel.",
    safeguard: "Independent verification",
    response: "Suggest checking through the official app or a known, independently sourced contact method.",
    takeaway: "Break the attacker's control over the conversation.",
  },
  {
    name: "Escalation",
    title: "The request turns personal.",
    attacker: "A one-time code, password, remote access, or another sensitive detail becomes the next demand.",
    safeguard: "OTP Guard",
    response: "Holds a passcode for 60 seconds when it arrives during a call from an unknown number.",
    takeaway: "A small pause before revealing a secret can change the outcome.",
  },
  {
    name: "Extraction",
    title: "The moment damage could happen.",
    attacker: "The conversation culminates in moving a number, changing an account, or sending money.",
    safeguard: "Account interlock",
    response: "Model a cooling-off period before a hard-to-reverse carrier action. The live account is never touched.",
    takeaway: "Safeguards belong at the point of potential loss.",
  },
  {
    name: "Post-loss",
    title: "There is still something to do.",
    attacker: "A customer suspects they already gave away information or approved something unsafe.",
    safeguard: "Recovery guidance",
    response: "Offer clear, exposure-specific steps and a path to official support. No real lockdown is claimed.",
    takeaway: "Help the person recover, not just identify what went wrong.",
  },
] as const;

export function KillChainExplorer() {
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const choose = useCallback((index: number) => {
    setAutoplay(false);
    setActive(index);
  }, []);

  useEffect(() => {
    if (!autoplay || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => setActive((current) => (current + 1) % STAGES.length), 3600);
    return () => window.clearInterval(interval);
  }, [autoplay]);

  const stage = STAGES[active];

  return (
    <section id="kill-chain" className="interlock-chain-section editorial-section border-t border-line bg-surface" aria-labelledby="chain-heading">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6" data-reveal>
          <div className="max-w-3xl">
            <p className="editorial-kicker">03 / THE SCAM KILL CHAIN</p>
            <h2 id="chain-heading" className="editorial-section-title mt-5">
              A scam is a sequence.<br />Not an event.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-[1.8] text-muted">
              Explore the six moments in a scam and the different protection Interlock proposes
              at each stage. Choose a stage or play the progression.
            </p>
          </div>
          <button
            type="button"
            className="chain-autoplay"
            onClick={() => setAutoplay((value) => !value)}
            aria-pressed={autoplay}
            aria-label={autoplay ? "Pause stage autoplay" : "Play stage autoplay"}
          >
            <span aria-hidden="true">{autoplay ? "Ⅱ" : "▶"}</span>
            {autoplay ? "Pause" : "Play the sequence"}
          </button>
        </div>

        <div className="chain-stage-nav mt-12" role="group" aria-label="Select a scam stage">
          {STAGES.map((item, index) => (
            <button
              key={item.name}
              type="button"
              onClick={() => choose(index)}
              aria-pressed={active === index}
              className={`chain-stage-button ${active === index ? "chain-stage-button-active" : ""}`}
            >
              <span className="chain-stage-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="chain-stage-name">{item.name}</span>
            </button>
          ))}
        </div>

        <div className="chain-story-grid mt-8" key={stage.name}>
          <div className="chain-story-main">
            <div className="flex items-center gap-3">
              <span className="chain-step-pill">STAGE {String(active + 1).padStart(2, "0")} / 06</span>
              <span className="text-xs text-faint">Attacker behavior</span>
            </div>
            <h3 className="mt-7 max-w-[20ch] text-[clamp(1.9rem,3.3vw,3.3rem)] font-medium leading-[1.17] tracking-[-0.055em] text-ink">
              {stage.title}
            </h3>
            <p className="mt-6 max-w-lg text-base leading-[1.8] text-muted">{stage.attacker}</p>
            <p className="mt-9 border-t border-line pt-5 text-sm font-medium text-ink">
              {stage.takeaway}
            </p>
          </div>
          <div className="chain-story-response">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">Interlock safeguard</p>
            <div className="mt-9 chain-safeguard-symbol" aria-hidden="true">⊘</div>
            <h4 className="mt-6 text-[clamp(1.8rem,2.5vw,2.55rem)] font-medium leading-tight tracking-[-0.05em] text-ink">
              {stage.safeguard}
            </h4>
            <p className="mt-4 max-w-md text-sm leading-[1.85] text-muted">{stage.response}</p>
            <Link href="/demo" className="mt-8 inline-flex items-center gap-3 text-sm font-semibold text-ink underline underline-offset-8 hover:text-brand">
              See it in the real demo <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between gap-4">
          <p aria-live="polite" className="text-xs text-faint">{stage.name} · {active + 1} of {STAGES.length}</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={active === 0} onClick={() => choose(active - 1)}
              className="chain-direction" aria-label="Previous stage">←</button>
            <button type="button" onClick={() => choose((active + 1) % STAGES.length)}
              className="chain-direction" aria-label="Next stage">→</button>
          </div>
        </div>
      </div>
    </section>
  );
}
