import Link from "next/link";
import { LandingPreview } from "@/components/landing-preview";
import { KillChainExplorer } from "@/components/killchain-explorer";

const PROTECTIONS = [
  {
    num: "01",
    title: "Understand the conversation.",
    body: "A single text can be misleading. Interlock follows a thread as the sender changes tactics, from creating urgency to asking you to keep secrets.",
    detail: "Thread-level risk / Reasoned warnings",
  },
  {
    num: "02",
    title: "Protect the deciding moment.",
    body: "A passcode request during a call, or a sensitive account change, deserves more than a warning. Interlock adds a pause when it matters.",
    detail: "OTP Guard / Account interlock",
  },
  {
    num: "03",
    title: "Know what to do after.",
    body: "If you think you were targeted, get a straightforward recovery checklist instead of navigating a maze of security settings.",
    detail: "Recovery / Independent verification",
  },
];



export default function Home() {
  return (
    <div className="editorial-site">
      <section className="editorial-hero" aria-label="Interlock introduction">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:pb-28 lg:pt-28">
          <div>
            <p className="editorial-kicker"><span className="editorial-kicker-dash" /> SECURITY, REIMAGINED</p>
            <h1 className="editorial-title mt-7">
              The scam isn’t the message.<br />
              <em>It’s what comes next.</em>
            </h1>
            <p className="mt-7 max-w-[32rem] text-lg leading-[1.8] text-muted">
              Interlock understands the full conversation, recognizes when risk is escalating,
              and puts a safeguard between a customer and the moment of loss.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/demo" className="editorial-primary-link">
                Watch an attack get stopped <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/analyze" className="editorial-outline-link">
                Try the analyzer <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <p className="mt-10 max-w-lg border-l-2 border-line-strong pl-4 text-xs leading-relaxed text-faint">
              Interlock only steps in when a conversation starts to look like a scam.
              You stay in control of every decision.
            </p>
          </div>
          <div className="min-w-0" data-reveal>
            <LandingPreview />
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 border-t border-line px-5 py-5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint sm:px-8">
          <span>Context first. Intervention when it matters.</span>
          <a href="#approach" className="hover:text-ink">Scroll to explore ↓</a>
        </div>
      </section>

      <section id="approach" className="editorial-section">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-9 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
            <div data-reveal>
              <p className="editorial-kicker">01 / THE IDEA</p>
              <h2 className="editorial-section-title mt-5">Not another red warning banner.</h2>
              <p className="mt-6 max-w-md text-base leading-[1.85] text-muted">
                Fraud protection should do more than label a message. It should help someone
                understand why a situation is risky and what they can safely do next.
              </p>
            </div>
            <div className="border-t border-line">
              {PROTECTIONS.map((item) => (
                <article key={item.num} className="editorial-protection-row" data-reveal>
                  <span className="editorial-row-number">{item.num}</span>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[-0.045em] text-ink">{item.title}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-[1.85] text-muted">{item.body}</p>
                    <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">{item.detail}</p>
                  </div>
                  <span className="editorial-row-arrow" aria-hidden="true">↗</span>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="editorial-dark-section" aria-label="Protecting the moment of loss">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24 lg:py-28">
          <div data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b4b0ad]">02 / THE DIFFERENCE</p>
            <h2 className="mt-6 max-w-[13ch] text-[clamp(2.6rem,5vw,4.8rem)] font-medium leading-[1.08] tracking-[-0.06em] text-[#f8f7f3]">
              Give people a moment to choose.
            </h2>
            <p className="mt-7 max-w-lg text-base leading-[1.85] text-[#c0beba]">
              Scams work by creating urgency. Interlock&apos;s safeguards
              interrupt the pressure without taking control away from the customer.
            </p>
            <Link href="/demo" className="mt-8 inline-flex items-center gap-3 text-sm font-semibold text-white underline decoration-white/40 underline-offset-8 hover:decoration-white">
              Watch the account action demo <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div data-reveal className="editorial-interlock-art">
            <div className="flex items-center justify-between border-b border-white/15 pb-5 text-xs text-white/60">
              <span>Interlock / Safeguard</span><span>ACCOUNT PROTECTION</span>
            </div>
            <div className="py-12">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Sensitive action requested</p>
              <p className="mt-4 max-w-md text-3xl font-medium leading-tight tracking-[-0.055em] text-white sm:text-4xl">
                Your number is about to be moved.
              </p>
              <p className="mt-5 max-w-sm text-sm leading-[1.85] text-white/60">
                Someone asked to change where your phone number works. Take a moment
                and verify this independently.
              </p>
              <div className="mt-10 flex items-center gap-4 border-t border-white/15 pt-6">
                <span className="editorial-pause-mark" aria-hidden="true">Ⅱ</span>
                <div>
                  <p className="text-sm font-semibold text-white">Cooling-off period proposed</p>
                  <p className="mt-1 text-xs text-white/55">10-minute pause · You stay in control</p>
                </div>
              </div>
            </div>
            <p className="border-t border-white/15 pt-5 text-[11px] leading-relaxed text-white/45">
              Interlock never blocks you. If the request is genuine, you can continue once the pause ends.
            </p>
          </div>
        </div>
      </section>

      <KillChainExplorer />

      <section className="editorial-section border-t border-line">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
          <div data-reveal>
            <p className="editorial-kicker">04 / PRIVACY</p>
            <h2 className="editorial-section-title mt-5">Your messages stay yours.</h2>
            <p className="mt-6 max-w-lg text-base leading-[1.85] text-muted">
              Interlock checks messages on your device. If you choose to report a scam,
              only a derived signature and a few coarse labels are shared, never the
              message itself.
            </p>
            <Link href="/privacy" className="mt-7 inline-flex text-sm font-semibold text-ink underline underline-offset-8 hover:text-brand">
              Read our privacy notice ↗
            </Link>
          </div>
          <div data-reveal className="editorial-privacy-diagram">
            <div className="editorial-diagram-half">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Remains on your device</p>
              <p className="mt-3 text-xl font-medium tracking-tight text-ink">Message content. Contact details. Conversation history.</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">Scam detection runs on your device.</p>
            </div>
            <div className="editorial-boundary"><span>DATA BOUNDARY</span></div>
            <div className="editorial-diagram-half">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Only when you report</p>
              <p className="mt-3 text-xl font-medium tracking-tight text-ink">A derived signature. Risk stage. Coarse labels.</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">Similarity signatures are not a guarantee of anonymity.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-bg px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl" data-reveal>
          <p className="editorial-kicker">TRY THE EXPERIENCE</p>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-7">
            <h2 className="max-w-[19ch] text-[clamp(2.8rem,6vw,5.5rem)] font-medium leading-[1.08] tracking-[-0.06em] text-ink">
              See the warning before it&apos;s too late.
            </h2>
            <div className="flex flex-wrap gap-3"><Link href="/demo" className="editorial-primary-link">Open live demo <span aria-hidden="true">↗</span></Link><Link href="/analyze" className="editorial-outline-link">Analyze a message ↗</Link></div>
          </div>
        </div>
      </section>
    </div>
  );
}
