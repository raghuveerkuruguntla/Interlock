# Interlock

**Interlock tracks whether a customer is being scammed — not whether a message is a scam.**

Built for the T-Mobile Scam & Fraud Challenge at HackUTD. Everything here runs on a
synthetic corpus authored for this project. No real customer data, no T-Mobile internal
systems, no call recordings, no network telemetry, no carrier API.

---

## The argument

Every anti-fraud product asks one question: *is this message malicious?* That question gets
answered at minute zero of an attack that takes forty minutes to land. The victim sees a
banner, dismisses it, and loses the money anyway.

Interlock models a scam as a five-stage kill chain, scores the whole conversation, and puts
a different safeguard at each stage — ending with a cooling-off hold on the irreversible
account changes a carrier uniquely controls.

| Stage | What the attacker is doing | Safeguard |
|---|---|---|
| Contact | Makes contact | Campaign match — blocks message two through forty thousand |
| Hook | Sets up the story | Grounded warning, or a question where the model is unsure |
| Isolation | Cuts you off from anyone who'd check | Out-of-band verification — the brand's real number |
| Escalation | Asks for what they came for | **OTP Guard** — holds a passcode during a call with an unknown number |
| Extraction | Moves something irreversible | **The interlock** — a cooling-off window on port-out, SIM swap, autopay |
| Post-loss | It already happened | Recovery mode — lock first, ask questions after |

Three properties the state machine guarantees, each covered by tests:

1. **Risk is cumulative and sticky.** A thread that reached Isolation does not drop back to
   Low because the next three messages are small talk. Accrued evidence halves only every 90
   minutes, and reaching a stage sets a permanent floor.
2. **Stages can be skipped but never un-entered.** A spoofed-bank SMS with a live
   credential-harvesting link jumps straight from Contact to Escalation.
3. **The model cannot act alone.** The text classifier's contribution is capped at half the
   risk, and capped again by how far the thread has actually got. It can never, by itself,
   put a hold on someone's account.

## What makes this different from Scam Shield

Scam ID, Scam Block and number blocking all work on the **inbound number**. Interlock scores
the **conversation** and gates the **account action**. The gap matters when the number is
clean, when the customer calls the scammer back, or when the attack moves to RCS, WhatsApp
or Telegram — none of which number-based filtering sees.

---

## Measured results

On the v3 holdout — 96 threads, never used for fitting or threshold selection:

| | |
|---|---|
| Scam threads that got a definite warning | **95%** (38/40) |
| False alarms on legitimate threads | **0** of 50 |
| Scams intervened on before the thread's final event | **100%**, median 60s of lead |
| Matched pairs treated identically on their shared opening | **100%** (160/160) |
| Times we called a scam from the shared opening alone | **0** |
| Prompt-injection payloads that changed a tier | **0** of 8 |

**Read every one of these as a measurement on authored, synthetic text.** It is not an
estimate of real traffic. Families, names and sentence structure recur across splits, so the
figures are optimistic. The full corpus (which includes training families) scores 71%, and
that number is published alongside the holdout rather than quietly dropped.

The adversarial suite is the part worth arguing with. Normalisation is measured with the
defence on and off, not asserted:

| Attack | Model alone | Engine, defence off | Engine, defence on |
|---|---:|---:|---:|
| Homoglyphs (every 3rd letter) | 63% | 5% | **100%** |
| Zero-width characters between letters | 84% | 0% | **100%** |
| Fullwidth characters | 100% | 0% | **100%** |
| Punctuation inside words | 47% | 5% | **97%** |
| Emoji between words | 76% | 42% | **100%** |
| Leetspeak | 53% | 0% | **53%** |
| **Polite corporate paraphrase** | 74% | 84% | **84%** |

The last row is the honest one: no amount of normalisation defeats a competent paraphrase.
Saying the same thing in the register of a real support agent costs an attacker nothing.

Full numbers, calibration curves and the false-positive accounting are on the `/evidence`
page, regenerated from the corpus on every change and checked in next to the code that
produced them.

---

## The privacy boundary is real, not asserted

Content scoring runs **in the browser**. The scikit-learn pipeline is exported to JSON and
re-implemented in TypeScript, and the port is held to exact parity with sklearn by fixtures
the training script emits (`tests/scorer.parity.test.ts`, 81 cases).

**Never leaves the device:** message text in any channel, contact names, the thread and its
history, anything typed into the demo. There is no call audio because there is no voice
analysis at all.

**Crosses, with consent:** a 64-bit SimHash of the normalised message template, the stage
label, the risk tier, a family from a fixed list, and an hour bucket.

The campaign API has no parameter for message text. Adding one would break the only privacy
claim the product makes, so the shape of the API is the enforcement.

---

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. The demo works offline after first load.

```bash
npm test          # 150 tests: sklearn parity, state machine, adversarial guards
npm run typecheck
npm run lint
npm run build
```

### Regenerating the model and the evidence

Python 3.10+ with `scikit-learn`, `numpy` and `joblib`:

```bash
python -I ml/export_model.py      # trains, exports public/model/{model,parity,metrics}.json
python -I ml/build_scenarios.py   # builds public/data/corpus.json from the CSVs
npx tsx scripts/evaluate.ts       # writes public/evidence/report.json
```

`export_model.py` emits the parity fixtures that the TypeScript tests assert against, so
retraining and forgetting to re-run the tests fails loudly rather than silently.

---

## Layout

```
app/              Next.js routes — landing, demo, evidence, network, limits, campaign API
components/       UI: phone thread, assessment panel, charts, settings
lib/engine/       The product
  types.ts        Stages, tiers, events, signals, safeguards
  signals.ts      Deterministic detectors — these do the scoring
  killchain.ts    The state machine: risk, stages, safeguards, decision receipts
  scorer.ts       TF-IDF + logistic inference, ported from sklearn
  normalize.ts    Obfuscation folding and campaign templates
  signature.ts    SimHash campaign signatures
  adversarial.ts  The suite we point at ourselves
  copy.ts         Every customer-facing string, in English and Spanish
lib/server/       The network side of the boundary
ml/               Training and data preparation (Python)
scripts/          The evaluation harness
data/             The synthetic corpus
tests/            Parity, state machine, adversarial regression guards
```

## Where the engine came from

The deterministic action safeguard and the synthetic corpus are derived from the Safe Signal
v3 research package. The regex detectors were ported to TypeScript and extended with the
isolation- and extraction-stage detectors the original did not need, because it scored single
messages rather than threads. The clause-local negation guard is carried over deliberately:
it is what stops a bank's genuine "we will never ask you for this code" from being read as a
code request, and without it the 160 matched pairs are not separable at all.

## Honest limits

- **No voice.** Most high-value scams run through a voice channel. The only way call content
  reaches the engine is when the customer describes it themselves, weighted and labelled as
  a recollection rather than a transcript.
- **The scoring model is English-only**, so the Spanish interface currently explains an
  English-trained decision.
- **Synthetic data only.** Real base rates and false-positive burden will differ.
- **A real bank fraud alert looks a lot like a fake one.** We have a threshold, a cost
  estimate and a response designed to help rather than block. Not a solution.
- **Nothing touches a real account.** The circuit breaker holds a simulated action; the
  campaign store is in-memory and resets when the server instance recycles.

The `/limits` page carries the full version, including the threat model against our own
system and what we deliberately chose not to build.

## Licence

Code is MIT. The synthetic corpus is fiction authored for this project and carries no real
person's data.
