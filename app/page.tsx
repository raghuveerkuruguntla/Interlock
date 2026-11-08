import Link from "next/link";
import { LandingPreview } from "@/components/landing-preview";
import report from "@/public/evidence/report.json";

const JOURNEY = [
  {
    number: "01",
    icon: "◎",
    title: "See the whole pattern",
    body: "A suspicious text alone does not tell the whole story. Interlock follows the conversation as the pressure builds.",
    foot: "CONTEXT, NOT JUST CLASSIFICATION",
  },
  {
    number: "02",
    icon: "◈",
    title: "Understand what changed",
    body: "Instead of a vague red flag, you get a plain-language reason, honest uncertainty, and a specific next step.",
    foot: "EXPLAINABLE WARNINGS",
  },
  {
    number: "03",
    icon: "✳",
    title: "Put time on your side",
    body: "At the critical moment, a simulated code hold or account-change delay interrupts the scammer’s urgency.",
    foot: "STAGE-AWARE SAFEGUARDS",
  },
];

const STAGES = [
  {
    number: "01", name: "Contact", label: "Notice the pattern",
    text: "A suspicious number, unfamiliar message, or repeated campaign appears.",
    action: "Campaign matching",
  },
  {
    number: "02", name: "Hook", label: "Question the story",
    text: "The sender introduces a problem, a deadline, or a tempting offer.",
    action: "A grounded warning",
  },
  {
    number: "03", name: "Isolation", label: "Reconnect to reality",
    text: "The attacker tells you not to call, ask questions, or check with anyone.",
    action: "Independent verification",
  },
  {
    number: "04", name: "Escalation", label: "Protect your codes",
    text: "The request turns into a passcode, payment, or sensitive account detail.",
    action: "OTP Guard (simulated)",
  },
  {
    number: "05", name: "Extraction", label: "Slow the irreversible",
    text: "Someone tries to move a phone number or change sensitive account settings.",
    action: "Cooling-off hold (simulated)",
  },
  {
    number: "06", name: "Recovery", label: "Make a plan",
    text: "If harm may already have happened, the customer gets clear recovery steps.",
    action: "Recovery guidance",
  },
];

const GAPS = [
  {
    label: "01 / NEW NUMBER",
    title: "The number looks normal",
    body: "Reputation-based filtering may not catch an attacker using a number with no prior reports.",
  },
  {
    label: "02 / OUTBOUND CALL",
    title: "The customer calls back",
    body: "The scam continues after a customer follows a callback instruction from the message.",
  },
  {
    label: "03 / CHANNEL CHANGE",
    title: "The conversation moves",
    body: "An attack can move from SMS to another app, while the underlying persuasion stays the same.",
  },
];

export default function Home() {
  const holdout = report.threadLevel.holdout;

  return (
    <div className="overflow-hidden">
      <section className="marketing-hero relative">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-10 lg:py-28">
          <div className="relative z-10">
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              A NEW LAYER OF SCAM PROTECTION
            </div>
            <h1 className="mt-7 max-w-[12ch] text-[clamp(3.3rem,5.4vw,5.75rem)] font-semibold leading-[1.035] tracking-[-0.065em] text-ink">
              Stop the scam <span className="hero-gradient-text">before the damage.</span>
            </h1>
            <p className="mt-7 max-w-[34rem] text-lg leading-[1.75] text-muted sm:text-xl">
              A scam is a conversation, not a single message. Interlock recognizes how an
              attack unfolds, explains what feels wrong, and shows the safest next move —
              before someone gives away a code or changes an account.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/demo" className="btn-primary group">
                Experience the live demo
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">↗</span>
              </Link>
              <Link href="#how-it-works" className="btn-secondary">
                Explore how it works <span aria-hidden="true">↓</span>
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-muted">
              <span className="flex items-center gap-2"><span className="text-ok">✓</span> On-device text analysis</span>
              <span className="flex items-center gap-2"><span className="text-ok">✓</span> Plain-language guidance</span>
              <span className="flex items-center gap-2"><span className="text-ok">✓</span> No real customer data</span>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-faint">
              HackUTD × T-Mobile scam &amp; fraud challenge · Independent research prototype.
              Safeguards and account actions are simulated.
            </p>
          </div>
          <LandingPreview />
        </div>
      </section>

      <section className="relative z-10 border-y border-line bg-surface" aria-label="Synthetic evaluation highlights">
        <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
          <div className="grid gap-7 md:grid-cols-[1fr_1fr_1fr] md:gap-0">
            <div className="metric-cell">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Synthetic scam threads flagged</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.055em] text-ink">
                {Math.round(holdout.asserted.recall * 100)}<span className="text-2xl text-brand">%</span>
              </p>
              <p className="mt-1 text-xs text-faint">{holdout.scams} scam threads in the v3 holdout</p>
            </div>
            <div className="metric-cell">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted">False alarms in holdout</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.055em] text-ink">
                {holdout.asserted.falsePositives}<span className="text-2xl text-faint"> / {holdout.benign}</span>
              </p>
              <p className="mt-1 text-xs text-faint">Legitimate synthetic conversations</p>
            </div>
            <div className="metric-cell">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Median early warning lead</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.055em] text-ink">
                {report.timeToIntervention.medianLeadSeconds}<span className="ml-1 text-2xl text-brand">sec</span>
              </p>
              <p className="mt-1 text-xs text-faint">Before the scenario’s final event</p>
            </div>
          </div>
          <p className="mt-8 text-center text-xs leading-relaxed text-faint md:mt-6">
            Results are from authored synthetic scenarios, not real-world performance estimates.
            <Link href="/evidence" className="ml-1 font-semibold text-brand underline-offset-4 hover:underline">Explore the evaluation ↗</Link>
          </p>
        </div>
      </section>

      <section id="how-it-works" className="section-pad bg-bg">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="section-kicker">PROTECTION THAT THINKS AHEAD</p>
            <h2 className="section-heading mt-4">Not another red warning banner.</h2>
            <p className="section-lead mt-5">
              A warning is only useful if you know what to do with it. Interlock turns
              evolving scam signals into understandable, stage-specific protection.
            </p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {JOURNEY.map((item) => (
              <article key={item.number} className="journey-card">
                <div className="flex items-start justify-between">
                  <span className="journey-icon" aria-hidden="true">{item.icon}</span>
                  <span className="font-mono text-xs font-semibold text-faint">{item.number} / 03</span>
                </div>
                <h3 className="mt-7 text-2xl font-semibold tracking-[-0.035em] text-ink">{item.title}</h3>
                <p className="mt-3 min-h-[6.5rem] text-base leading-relaxed text-muted">{item.body}</p>
                <p className="mt-7 border-t border-line pt-5 text-[11px] font-bold tracking-[0.13em] text-brand">{item.foot}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad bg-surface">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-20">
          <div>
            <p className="section-kicker">THE MOMENT THAT MATTERS</p>
            <h2 className="section-heading mt-4">Interrupt the urgency. <span className="text-brand">Not the customer.</span></h2>
            <p className="section-lead mt-5">
              The dangerous part of a scam is often the final step: revealing a passcode or
              approving a sensitive account change. Interlock models safeguards for that exact moment.
            </p>
            <div className="mt-7 space-y-4">
              <div className="flex gap-3">
                <span className="feature-tick">✓</span>
                <p className="text-sm leading-relaxed text-muted"><strong className="text-ink">OTP Guard</strong> introduces a moment to question a code request during a suspicious call.</p>
              </div>
              <div className="flex gap-3">
                <span className="feature-tick">✓</span>
                <p className="text-sm leading-relaxed text-muted"><strong className="text-ink">Account interlock</strong> illustrates a cooling-off window before a hard-to-reverse change.</p>
              </div>
              <div className="flex gap-3">
                <span className="feature-tick">✓</span>
                <p className="text-sm leading-relaxed text-muted"><strong className="text-ink">Recovery guidance</strong> gives clear next steps if a customer may already be exposed.</p>
              </div>
            </div>
            <Link href="/demo" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">
              See the safeguards fire in the demo <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="interlock-illustration">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white"><span className="h-2 w-2 rounded-full bg-[#a9f3d4]" /> Safeguard preview</span>
              <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-medium text-white/70">SIMULATED</span>
            </div>
            <div className="mt-9 rounded-[1.5rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur-md sm:p-7">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 text-2xl text-white" aria-hidden="true">⌛</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/60">Critical action detected</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">A moment to make sure</h3>
                </div>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-white/80">
                Someone is asking to move your phone number while this conversation shows signs of pressure.
              </p>
              <div className="mt-6 rounded-xl bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Suggested pause</span>
                  <span className="text-sm font-bold text-brand">10 minutes</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full w-2/5 rounded-full bg-brand" />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">Take a minute. Verify the request independently before proceeding.</p>
              </div>
            </div>
            <p className="mt-5 text-xs leading-relaxed text-white/65">
              Concept visualization only. Interlock does not connect to or hold real carrier account actions.
            </p>
          </div>
        </div>
      </section>

      <section className="section-pad bg-bg">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="section-kicker">A DEFENSE FOR EVERY STAGE</p>
            <h2 className="section-heading mt-4">The scam evolves. So does the response.</h2>
            <p className="section-lead mt-5">
              Interlock follows a five-stage attack sequence, with recovery guidance if
              the loss may have already happened. Evidence accumulates as the conversation unfolds.
            </p>
          </div>
          <ol className="mt-11 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {STAGES.map((stage) => (
              <li key={stage.number} className="stage-card">
                <div className="flex items-center justify-between">
                  <span className="stage-number">{stage.number}</span>
                  <span className="h-px w-10 bg-line" aria-hidden="true" />
                </div>
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-brand">{stage.name}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">{stage.label}</h3>
                <p className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-muted">{stage.text}</p>
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4">
                  <span className="text-xs font-semibold text-ink">{stage.action}</span>
                  <span aria-hidden="true" className="text-brand">↗</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-pad border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <p className="section-kicker">BUILT TO COMPLEMENT EXISTING DEFENSES</p>
              <h2 className="section-heading mt-4">Scams don’t stay in one inbox.</h2>
              <p className="section-lead mt-5">
                Number-based protection is valuable. Interlock explores what happens when
                the attacker’s influence continues beyond the first inbound message.
              </p>
              <Link href="/network" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">
                Explore privacy-preserving campaign matching <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className="space-y-3">
              {GAPS.map((gap) => (
                <article key={gap.label} className="gap-row">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-[0.13em] text-brand">{gap.label}</p>
                    <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-ink">{gap.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{gap.body}</p>
                  </div>
                  <span className="mt-1 text-xl text-brand" aria-hidden="true">↗</span>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad bg-bg">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="section-kicker">PRIVACY IS THE ARCHITECTURE</p>
            <h2 className="section-heading mt-4">Protected by design. Not by a promise.</h2>
            <p className="section-lead mt-5">
              The engine analyzes text in your browser. An explicitly triggered campaign report
              sends a derived signature and limited labels — not the message itself.
            </p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <div className="privacy-card">
              <div className="flex items-center gap-3">
                <span className="privacy-icon privacy-icon-local" aria-hidden="true">⌂</span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-ok">STAYS WITH YOU</p>
                  <h3 className="mt-1 text-xl font-semibold text-ink">On-device by default</h3>
                </div>
              </div>
              <ul className="mt-7 space-y-4">
                {["Message text and the conversation history", "Contact names and your typed demo content", "Local scoring and safeguard decisions", "No call audio is collected or analyzed"].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-muted"><span className="text-ok" aria-hidden="true">✓</span>{item}</li>
                ))}
              </ul>
            </div>
            <div className="privacy-card">
              <div className="flex items-center gap-3">
                <span className="privacy-icon" aria-hidden="true">↗</span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-brand">SHARED ONLY ON REPORT</p>
                  <h3 className="mt-1 text-xl font-semibold text-ink">Limited campaign signals</h3>
                </div>
              </div>
              <ul className="mt-7 space-y-4">
                {["A derived 64-bit message-template signature", "A risk tier and attack-stage label", "A fixed category, rather than free-form message text", "No passwords, messages, or contact details in the API payload"].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-muted"><span className="text-brand" aria-hidden="true">✓</span>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-faint">
            This is a research prototype, not a deployed carrier service. A derived similarity signature is not a guarantee of anonymity.
            <Link href="/limits" className="ml-1 font-semibold text-brand hover:underline">Read the privacy and security limits ↗</Link>
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface">
        <div className="mx-auto grid max-w-7xl items-center gap-9 px-5 sm:px-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="section-kicker">SHOW THE WORK</p>
            <h2 className="section-heading mt-4">Every claim should be testable.</h2>
            <p className="section-lead mt-4 max-w-3xl">
              Explore the held-out synthetic evaluation, adversarial tests, classifier limitations,
              and the exact safeguards produced by the engine. We surface failures alongside successes.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/evidence" className="btn-primary">Review the evidence <span aria-hidden="true">↗</span></Link>
            <Link href="/limits" className="btn-secondary">Known limitations <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-[#181a37] px-6 py-12 text-white sm:px-12 sm:py-14 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b8a9ff]">READY TO SEE IT HAPPEN?</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.05em] sm:text-4xl">
              Follow a scam. Watch the safeguard appear.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65">Try fictional scenarios with real, local engine decisions. No login. No real customer information.</p>
          </div>
          <Link href="/demo" className="mt-7 inline-flex shrink-0 items-center justify-center gap-3 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[#181a37] transition-transform hover:-translate-y-0.5 lg:mt-0">
            Launch interactive demo <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
