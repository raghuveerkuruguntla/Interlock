import type { Metadata } from "next";
import {
  AttackChart,
  ReliabilityChart,
  StatTile,
  ThresholdChart,
  type AttackRow,
  type ReliabilityBin,
  type SweepPoint,
} from "@/components/charts";
import metrics from "@/public/model/metrics.json";
import report from "@/public/evidence/report.json";

export const metadata: Metadata = {
  title: "Evidence",
  description:
    "Calibration, thread-level outcomes, adversarial robustness, prompt-injection results and the cost of our own false positives — measured on a synthetic corpus and labelled as such.",
};

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line pt-10">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {lede && <p className="mt-2 max-w-3xl text-muted">{lede}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function pct(v: number, digits = 0) {
  return `${(v * 100).toFixed(digits)}%`;
}

/**
 * The false-positive list is empty on the current corpus, so TypeScript infers
 * `never[]` from the JSON. Declaring the shape keeps the rendering path honest:
 * if a future run does flag a legitimate thread, the page shows it rather than
 * failing to compile.
 */
interface FalsePositiveCase {
  id: string;
  familyLabel: string;
  tier: string;
  stage: string;
  signals: string[];
  cost: string;
  firstMessage: string;
}

export default function EvidencePage() {
  const holdout = report.threadLevel.holdout;
  const all = report.threadLevel.all;
  const modelHoldout = metrics.sets.find((s) => s.name === "holdout")!;
  const modelChallenge = metrics.sets.find((s) => s.name === "challenge")!;

  const sweep: SweepPoint[] = Object.values(modelHoldout.sweep).map((s) => ({
    threshold: s.threshold,
    recall: s.recall,
    false_positive_rate: s.false_positive_rate,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Evidence</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted">
          Everything below is produced by{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-sm">scripts/evaluate.ts</code>{" "}
          and <code className="rounded bg-surface-2 px-1 py-0.5 text-sm">ml/export_model.py</code>,
          regenerated from the corpus on every change, and checked into the repository
          alongside the code that produced it.
        </p>
      </header>

      <div
        className="mt-6 rounded-card border px-5 py-4"
        style={{ borderColor: "var(--tier-elevated)", background: "var(--tier-elevated-soft)" }}
      >
        <p className="font-semibold" style={{ color: "var(--tier-elevated)" }}>
          Read every number here as a measurement on authored, synthetic text.
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">
          It is not an estimate of real traffic. Families, names and sentence structure recur
          across the splits, so these figures are optimistic, and the separately-authored
          challenge set comes from the same project and is not external validation.
          Real-world base rates and false-positive burden will differ, possibly by a lot.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Scams caught"
          value={pct(holdout.asserted.recall)}
          note={`${holdout.scams} scam threads in the v3 holdout, which was never used for fitting or threshold choice.`}
          tone="good"
        />
        <StatTile
          label="False alarms"
          value={pct(holdout.asserted.falsePositiveRate)}
          note={`${holdout.asserted.falsePositives} of ${holdout.benign} legitimate threads reached a tier that asserts a warning.`}
          tone="good"
        />
        <StatTile
          label="Calibration error"
          value={pct(modelHoldout.calibration.expected_calibration_error, 1)}
          note="How far the text model's stated confidence sits from what actually happened."
          tone="warn"
        />
        <StatTile
          label="Caught before the last move"
          value={pct(report.timeToIntervention.shareBeforeFinalEvent)}
          note={`Median lead of ${report.timeToIntervention.medianLeadSeconds}s before the final event of the thread.`}
          tone="good"
        />
      </div>

      <div className="mt-14 space-y-14">
        <Section
          id="threads"
          title="We measure threads, not messages"
          lede="The unit of detection is a conversation, so the headline number is a thread-level one. Both splits are shown: the holdout is the honest figure, and the full corpus is worse because it contains training families the detectors cover less evenly. Reporting only the better one would be the easy choice."
        >
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">Set</th>
                  <th className="px-4 py-3 font-medium text-muted">Threads</th>
                  <th className="px-4 py-3 font-medium text-muted">Asserted a warning</th>
                  <th className="px-4 py-3 font-medium text-muted">False alarms</th>
                  <th className="px-4 py-3 font-medium text-muted">Intervened</th>
                </tr>
              </thead>
              <tbody>
                {[holdout, all].map((row) => (
                  <tr key={row.set} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">
                        {row.set.split(" (")[0]}
                      </span>
                      <span className="block text-xs text-faint">
                        {row.scams} scams · {row.benign} legitimate · {row.ambiguous} ambiguous
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{row.n}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-ink">
                      {pct(row.asserted.recall)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {pct(row.asserted.falsePositiveRate)}
                      <span className="ml-1.5 text-xs text-faint">
                        ({row.asserted.falsePositives}/{row.benign})
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{pct(row.intervened.onScams)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">
            “Asserted” means the thread reached a tier that shows a definite warning.
            “Intervened” is broader — any safeguard that added real friction — and it is the
            number that matters for whether a loss was prevented.
          </p>
          <p className="mt-2 text-sm text-muted">
            On the six deliberately ambiguous threads, which carry no binary label by design,
            the right behaviour is to not assert.{" "}
            <strong className="text-ink">
              {pct(all.abstained.onAmbiguous)} were handled without an assertion.
            </strong>
          </p>
        </Section>

        <Section
          id="calibration"
          title="Calibration, not accuracy"
          lede="A model that says 0.8 should be right about 80% of the time. That is the property that decides whether someone should act on a warning, and most models are badly overconfident. We report ours, including where it is wrong."
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-card border border-line bg-surface p-5">
              <ReliabilityChart
                bins={modelHoldout.calibration.bins as ReliabilityBin[]}
                ece={modelHoldout.calibration.expected_calibration_error}
                title="v3 holdout — never used for fitting"
              />
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <ReliabilityChart
                bins={modelChallenge.calibration.bins as ReliabilityBin[]}
                ece={modelChallenge.calibration.expected_calibration_error}
                title="Separately-authored challenge set"
              />
            </div>
          </div>

          <div className="mt-6 rounded-card border border-line bg-surface p-5">
            <h3 className="font-semibold">The abstain zone</h3>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
              Between {modelHoldout.abstain.band_low} and {modelHoldout.abstain.band_high} the
              product does not assert. It asks: did you contact them first, or did they
              contact you? Turning uncertainty into a question rather than a red banner is
              more honest, and it attacks alert fatigue — the real reason warnings get
              ignored.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="font-mono text-2xl text-ink">
                  {pct(modelHoldout.abstain.in_band_share)}
                </p>
                <p className="text-xs text-muted">of holdout threads land in the band</p>
              </div>
              <div>
                <p className="font-mono text-2xl text-ink">
                  {modelHoldout.abstain.confident_accuracy === null
                    ? "—"
                    : pct(modelHoldout.abstain.confident_accuracy)}
                </p>
                <p className="text-xs text-muted">
                  accuracy outside the band — what a stated verdict is actually worth
                </p>
              </div>
              <div>
                <p className="font-mono text-2xl text-ink">
                  {pct(modelHoldout.calibration.maximum_calibration_error, 1)}
                </p>
                <p className="text-xs text-muted">worst single bin</p>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="threshold"
          title="Where we set the line, and why"
          lede={metrics.threshold_selection}
        >
          <div className="rounded-card border border-line bg-surface p-5">
            <ThresholdChart points={sweep} chosen={metrics.threshold} />
          </div>
        </Section>

        <Section
          id="pairs"
          title="The matched pairs"
          lede={report.matchedPairs.description}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Identical on the opener"
              value={pct(report.matchedPairs.shareIdenticalOnOpening)}
              note="The two halves of a pair get the same treatment from their shared first message — which is the only defensible behaviour, since the message is the same."
              tone="good"
            />
            <StatTile
              label="Asserted on the opener alone"
              value={String(report.matchedPairs.assertedScamOnOpeningAlone)}
              note="Times we called a scam from the shared opening message. It should be zero, and it is."
              tone="good"
            />
            <StatTile
              label="Separated by the end"
              value={pct(report.matchedPairs.shareSeparated)}
              note="Pairs where the attack ended up flagged and its legitimate twin did not. The rest is honest headroom."
              tone="warn"
            />
          </div>

          <div className="mt-5 overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium text-muted">Shared opening message</th>
                  <th className="px-4 py-3 font-medium text-muted">Model</th>
                  <th className="px-4 py-3 font-medium text-muted">On the opener</th>
                  <th className="px-4 py-3 font-medium text-muted">Attack ends</th>
                  <th className="px-4 py-3 font-medium text-muted">Twin ends</th>
                </tr>
              </thead>
              <tbody>
                {report.matchedPairs.examples.slice(0, 8).map((ex) => (
                  <tr key={ex.pairId} className="border-b border-line/60 last:border-0">
                    <td className="max-w-sm px-4 py-3">
                      <span className="text-ink">{ex.opening}</span>
                      <span className="block text-xs text-faint">{ex.familyLabel}</span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {ex.openingModelProbability?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono">{ex.openingTier}</td>
                    <td className="px-4 py-3 font-mono text-ink">{ex.scamFinalTier}</td>
                    <td className="px-4 py-3 font-mono text-ink">{ex.benignFinalTier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-muted">
            Look at the model column. Our own classifier rates several of these coin-flip
            openings well above 0.9. That is exactly why the model&apos;s contribution is
            capped by how far the thread has actually got: at first contact, a confident
            score is not evidence.
          </p>
        </Section>

        <Section
          id="redteam"
          title="We attacked our own detector"
          lede={report.redTeam.description}
        >
          <div className="rounded-card border border-line bg-surface p-5">
            <AttackChart
              rows={report.redTeam.attacks as AttackRow[]}
              baseline={report.redTeam.baseline.engine}
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-line bg-surface p-5">
              <h3 className="font-semibold">The attack that still works</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Normalisation folds away homoglyphs, zero-width characters, fullwidth text and
                punctuation wedged inside words — all of which a reader sees through, which is
                the attacker&apos;s binding constraint. What it cannot touch is a competent
                paraphrase. Saying the same thing in the register of a real support agent
                costs an attacker nothing and we lose ground on it, which is reported above
                rather than left out.
              </p>
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h3 className="font-semibold">The payload split across messages</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {report.redTeam.splitPayload.description}
              </p>
              <div className="mt-4 flex gap-6">
                <div>
                  <p className="font-mono text-2xl text-ink">
                    {pct(report.redTeam.splitPayload.perMessageClassifier)}
                  </p>
                  <p className="text-xs text-muted">per-message classifier</p>
                </div>
                <div>
                  <p className="font-mono text-2xl" style={{ color: "var(--ok)" }}>
                    {pct(report.redTeam.splitPayload.threadEngine)}
                  </p>
                  <p className="text-xs text-muted">thread-level engine</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="injection"
          title="Prompt injection against our own pipeline"
          lede={report.promptInjection.description}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Tiers held"
              value={report.promptInjection.allScamTiersHeld ? "All" : "Some failed"}
              note={`${report.promptInjection.payloads} payloads appended to a live scam thread.`}
              tone={report.promptInjection.allScamTiersHeld ? "good" : "warn"}
            />
            <StatTile
              label="Safeguards held"
              value={report.promptInjection.allSafeguardsHeld ? "All" : "Some failed"}
              note="No payload suppressed a safeguard that had already fired."
              tone={report.promptInjection.allSafeguardsHeld ? "good" : "warn"}
            />
            <StatTile
              label="False escalation"
              value={report.promptInjection.noFalseEscalation ? "None" : "Some"}
              note="No payload turned a benign message into an alarm either."
              tone={report.promptInjection.noFalseEscalation ? "good" : "warn"}
            />
          </div>

          <div className="mt-5 rounded-card border border-line bg-surface p-5">
            <h3 className="font-semibold">Why it holds</h3>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
              {report.promptInjection.mitigations.map((m, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden className="text-faint">
                    {i + 1}.
                  </span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-3 text-sm text-muted">
              Worth being precise: nothing here is a blocklist. The payloads are not stripped,
              detected or filtered. They simply have nowhere to act, because no step in the
              pipeline reads English and obeys it.
            </p>
          </div>
        </Section>

        <Section
          id="cost"
          title="What our false positives cost"
          lede={report.falsePositiveCost.description}
        >
          {report.falsePositiveCost.flagged === 0 ? (
            <div className="rounded-card border border-line bg-surface p-5">
              <p className="text-ink">
                On the {report.falsePositiveCost.benign} legitimate threads in the holdout,
                nothing reached a tier that asserts a warning.
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
                That is a good number and it should be read carefully. It is measured on
                synthetic text where legitimate messages were authored to be clearly
                legitimate. In the field a real fraud alert from a real bank looks a great
                deal like a fake one — urgent, with a link and a callback number. The{" "}
                <strong className="text-ink">“A real alert that looks wrong”</strong> thread in
                the demo is exactly that case, and it is the one to watch. Our answer is that
                the elevated response to it is a helpful one — here is the real number for
                your bank — rather than a block.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {(report.falsePositiveCost.cases as FalsePositiveCase[]).map((c) => (
                <li key={c.id} className="rounded-card border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-ink">{c.familyLabel}</span>
                    <span className="font-mono text-xs text-faint">{c.tier}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted">“{c.firstMessage}”</p>
                  <p className="mt-1.5 text-sm" style={{ color: "var(--tier-elevated)" }}>
                    Cost: {c.cost}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          id="signatures"
          title="What crosses the privacy boundary"
          lede={report.campaignSignatures.description}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-line bg-surface p-5">
              <h3 className="text-sm font-semibold">Variants of one campaign</h3>
              <ul className="mt-2 space-y-1.5 font-mono text-xs">
                {report.campaignSignatures.variantDistances.map((v, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span
                      className="w-10 shrink-0 text-right"
                      style={{ color: "var(--ok)" }}
                    >
                      {v.distance} bits
                    </span>
                    <span className="truncate text-faint">{v.normalisedTemplate}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">
                {report.campaignSignatures.variantsWithinRadius} of{" "}
                {report.campaignSignatures.variantDistances.length} inside the matching radius
                of {report.campaignSignatures.radius}.
              </p>
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h3 className="text-sm font-semibold">Unrelated messages</h3>
              <ul className="mt-2 space-y-1.5 text-xs">
                {report.campaignSignatures.unrelatedDistances.map((u, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span className="w-10 shrink-0 text-right font-mono text-muted">
                      {u.distance} bits
                    </span>
                    <span className="truncate text-faint">{u.text}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">
                {report.campaignSignatures.unrelatedWithinRadius} of{" "}
                {report.campaignSignatures.unrelatedDistances.length} inside the radius. The
                gap between the two columns is what makes the radius defensible.
              </p>
            </div>
          </div>
        </Section>

        <Section id="limits" title="The limits of everything above">
          <ul className="space-y-2.5">
            {report.honestLimits.map((limit, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span aria-hidden style={{ color: "var(--tier-elevated)" }}>
                  ▲
                </span>
                <span className="text-ink">{limit}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
