import Link from "next/link";
import report from "@/public/evidence/report.json";

const STAGES = [
  {
    name: "Contact",
    attacker: "Makes contact. A notice, a wrong number, a job offer.",
    safeguard: "Campaign match",
    detail: "Blocks message two through forty thousand of a campaign one person reported.",
  },
  {
    name: "Hook",
    attacker: "Sets up a story — a problem, a deadline, a link.",
    safeguard: "Grounded warning, or a question",
    detail: "States the reasons in human words. Where the model is unsure, it asks instead.",
  },
  {
    name: "Isolation",
    attacker: "Cuts you off from anyone who would check.",
    safeguard: "Out-of-band verification",
    detail: "Replaces the attacker's callback number with the brand's real one.",
  },
  {
    name: "Escalation",
    attacker: "Asks for the thing they came for.",
    safeguard: "OTP Guard",
    detail: "Holds a passcode for 60 seconds during a call with an unknown number.",
  },
  {
    name: "Extraction",
    attacker: "Moves something irreversible.",
    safeguard: "The interlock",
    detail: "A cooling-off window on port-out, SIM swap, autopay and authorised users.",
  },
  {
    name: "Post-loss",
    attacker: "It already happened.",
    safeguard: "Recovery mode",
    detail: "One button: lock the account, the call list in order, the signature propagates.",
  },
];

const CLAIMS = [
  {
    title: "Detection is a thread-level state machine, not a message classifier.",
    body: "“There is a pending change on the mobile line ending 42.” scores 0.914 on our own classifier — and it is a coin flip, because that exact sentence opens both halves of a matched pair in the corpus. The same message followed by thirty minutes of chat and “don't call T-Mobile, that will just lock the ticket” is a completely different product response. We score the conversation.",
  },
  {
    title: "The highest-value signals are victim-side, and only a carrier has them.",
    body: "A one-time passcode arriving during an active call with an unknown number is about the highest-precision fraud signal that exists. No app-layer competitor can see both halves of it. Interlock holds the code for sixty seconds and says why.",
  },
  {
    title: "We intervene where the loss happens, not where the message arrives.",
    body: "Port-out, SIM swap, autopay change, passcode disclosure. Urgency is the attacker's only weapon, and a ten-minute cooling-off window disarms it without ever blocking the customer. We do not stop you. We slow them down.",
  },
];

export default function Home() {
  const holdout = report.threadLevel.holdout;

  return (
    <div>
      {/* ---------------------------------------------------------- hero --- */}
      <section className="mx-auto max-w-5xl px-4 pb-14 pt-16 sm:px-6 sm:pt-24">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
          T-Mobile scam &amp; fraud challenge · research prototype
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Interlock tracks whether a customer is being scammed — not whether a message is a
          scam.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">
          Every anti-fraud product asks one question: is this message malicious? That gets
          answered at minute zero of an attack that takes forty minutes to land. The victim
          sees a banner, dismisses it, and loses the money anyway. Interlock models a scam as
          a five-stage kill chain, scores the whole conversation, and puts a different
          safeguard at each stage — ending with a hard interlock on the irreversible actions
          a carrier uniquely controls.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/demo"
            className="rounded-md bg-brand px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90"
          >
            Watch an attack get stopped
          </Link>
          <Link
            href="/evidence"
            className="rounded-md border border-line-strong px-5 py-2.5 font-medium transition-colors hover:bg-surface-2"
          >
            See how it was measured
          </Link>
        </div>

        <dl className="mt-12 grid gap-x-8 gap-y-5 border-t border-line pt-8 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Scam threads caught</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight">
              {Math.round(holdout.asserted.recall * 100)}%
            </dd>
            <dd className="text-xs text-faint">
              v3 holdout, {holdout.scams} threads, never used for fitting
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">False alarms</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight">
              {holdout.asserted.falsePositives}
              <span className="text-xl text-muted">/{holdout.benign}</span>
            </dd>
            <dd className="text-xs text-faint">legitimate threads in the same holdout</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Caught before the final move</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight">
              {Math.round(report.timeToIntervention.shareBeforeFinalEvent * 100)}%
            </dd>
            <dd className="text-xs text-faint">
              median {report.timeToIntervention.medianLeadSeconds}s of lead time
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-faint">
          Measured on an authored synthetic corpus. Not an estimate of real traffic — see{" "}
          <Link href="/evidence" className="underline underline-offset-4">
            the evidence page
          </Link>{" "}
          for what these numbers can and cannot support.
        </p>
      </section>

      {/* ------------------------------------------------- scam shield gap --- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">
            T-Mobile already ships Scam Shield. Here is what it does not cover.
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted">
            Scam ID, Scam Block and number blocking all work on the inbound number. That is
            genuinely valuable and it is not what this is. It blocks nothing when the number
            is clean, nothing when the customer calls the scammer back, and nothing when the
            attack moves to RCS, WhatsApp or Telegram. Interlock scores the conversation and
            gates the account action — which is the part a carrier is uniquely placed to do
            and nobody else can.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["The number is clean", "Most of the arcs in our corpus never use a flagged number at all."],
              ["The customer calls them back", "Inbound filtering never sees an outbound call."],
              ["The attack moves channel", "RCS, WhatsApp and Telegram are outside number-based filtering entirely."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-card border border-line bg-bg p-4">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-snug text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ kill chain --- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">The scam kill chain</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted">
          A scam is a sequence, not an event. Attackers run a repeatable arc, and every stage
          of it is vulnerable to a different safeguard — which is why a single verdict
          delivered at first contact defends the wrong end of the attack. Risk is cumulative
          and sticky: a thread that reached Isolation does not drop back because the next
          three messages are small talk.
        </p>

        <ol className="mt-8 grid gap-3 lg:grid-cols-6">
          {STAGES.map((stage, i) => (
            <li
              key={stage.name}
              className="relative rounded-card border border-line bg-surface p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white"
                  style={{
                    background: `color-mix(in srgb, var(--tier-critical) ${20 + i * 16}%, var(--tier-low))`,
                  }}
                >
                  {i + 1}
                </span>
                <h3 className="text-sm font-semibold">{stage.name}</h3>
              </div>
              <p className="mt-2 text-xs leading-snug text-muted">{stage.attacker}</p>
              <div className="mt-3 border-t border-line pt-2.5">
                <p className="text-xs font-semibold" style={{ color: "var(--brand)" }}>
                  {stage.safeguard}
                </p>
                <p className="mt-1 text-xs leading-snug text-faint">{stage.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------- claims --- */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            Three claims, each one checkable
          </h2>
          <div className="mt-8 space-y-8">
            {CLAIMS.map((claim, i) => (
              <div key={i} className="grid gap-4 border-t border-line pt-6 sm:grid-cols-[2.5rem_1fr]">
                <span aria-hidden className="font-mono text-2xl text-faint">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold leading-snug">{claim.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{claim.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- privacy boundary --- */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Where the line is drawn</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted">
          Asserting “privacy by design” costs nothing. Showing which bytes cross and which do
          not is the version worth believing — so in this build, content scoring genuinely
          runs in your browser. The model is a static file your device downloads once. Nothing
          you type is ever posted anywhere.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div
            className="rounded-card border p-5"
            style={{ borderColor: "var(--ok)", background: "var(--ok-soft)" }}
          >
            <h3 className="font-semibold" style={{ color: "var(--ok)" }}>
              Stays on the device, always
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm text-ink">
              {[
                "Message text, in every channel",
                "Contact names and who you talk to",
                "Call audio — there is none, we do no voice analysis at all",
                "The whole thread and its history",
                "Everything you type into the demo",
              ].map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-line bg-surface p-5">
            <h3 className="font-semibold">Crosses, only with consent</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-ink">
              {[
                "A 64-bit campaign signature that cannot be inverted into text",
                "The stage label and the risk tier",
                "A family chosen from a fixed list, never free text",
                "The hour it happened, not the minute",
              ].map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-3 text-xs leading-snug text-muted">
              The campaign endpoint has no parameter for message text. Adding one would break
              the only privacy claim the product makes, so the shape of the API is the
              enforcement.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-card border border-line bg-surface p-5">
          <h3 className="font-semibold">One victim reports, and the next forty thousand are immune.</h3>
          <p className="mt-2 max-w-3xl leading-relaxed text-muted">
            The reporting device hashes the normalised message template. The network clusters
            signatures into campaigns and pushes verdicts back down, so everyone targeted by
            the same campaign in the next ten minutes gets a block — and no message text ever
            moved. It takes the one thing a victim has, which is shame, and converts it into
            protection for thousands of strangers.
          </p>
          <Link
            href="/network"
            className="mt-4 inline-block text-sm underline underline-offset-4 hover:text-ink"
          >
            See the campaign network →
          </Link>
        </div>
      </section>

      {/* ----------------------------------------------------------- close --- */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">Built for the people targeted</h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-muted">
            The people losing the most money to scams are the people least served by the tools
            built to stop them. Every warning here is written at a fifth-grade reading level,
            with no jargon in the victim path — not “SIM swap” but “someone is trying to move
            your phone number to a different phone”. Spanish is a full locale, not a
            translated banner over an English flow. There is a large-type mode and a light
            mode, both in the header, both worth trying on the demo.
          </p>
        </div>
      </section>
    </div>
  );
}
