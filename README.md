# Interlock

**Interlock tracks whether a customer is being scammed — not whether a message is a scam.**

Built for the T-Mobile Scam & Fraud Challenge at HackUTD. Everything here runs on a
synthetic corpus authored for this project. No real customer data, no T-Mobile internal
systems, no call recordings, no network telemetry, no carrier API.

Source: <https://github.com/raghuveerkuruguntla/Interlock>

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
history, anything typed into the demo. Interlock never records call audio. Live call
analysis (below) is opt-in per session and works on transcribed text only.

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

### SpacetimeDB Incident Demo

The campaign-network prototype remains separate and read-only with respect to reports.
Incident coordination uses the TypeScript SpacetimeDB 2.x module in `spacetimedb/` and
stores only a generated incident ID, server-issued identity, coarse-hour timestamps,
fixed exposure/severity/urgency values, status, consent time, and status audit events.
Raw messages, numbers, contacts, OTP values, credentials, card details, and conversation
histories are not accepted by its reducers. The identities are pseudonymous database
identities, not proof of real-world people. All carrier workflows are simulated; no T-Mobile
API is connected.

1. Install the official SpacetimeDB CLI, then start the local database on port 4000 so it
  does not conflict with Next.js on port 3000:

  ```bash
  npm run spacetimedb:start
  ```

2. In another terminal, register the local server, build/publish the module, and generate
  the official client bindings:

  ```bash
  npm install
  npm install --prefix spacetimedb --workspaces=false
  spacetime server add interlock-local --url http://127.0.0.1:4000
  npm run spacetimedb:build
  spacetime publish --server interlock-local --module-path spacetimedb interlock-incidents
  spacetime generate --lang typescript --out-dir lib/spacetime/module_bindings --module-path spacetimedb
  ```

  The first publisher becomes the immutable database owner in the module's `init` reducer.
  A CLI login may be required by the selected host; handle that only in the local CLI. Keep
  the owner's CLI identity private; it is not embedded in the site.

3. Install app and module dependencies, copy `.env.example` to `.env.local`, and run
  `npm run dev`. The example points the browser to `ws://127.0.0.1:4000`.

4. For a two-session demo, open `/demo` in a customer browser session and `/operator` in a
  separate browser profile or private window. The operator console displays that session's
  SpacetimeDB identity. The database owner provisions that exact identity through the CLI:

  ```bash
  spacetime call --server interlock-local interlock-incidents grant_operator '"<IDENTITY_HEX>"'
  ```

  Refresh the operator page after provisioning. Submit a minimized incident from the customer
  page, acknowledge it in the operator console, and watch the customer status update over the
  subscriptions without refreshing. Reducers enforce owner/operator roles; changing a URL,
  client role flag, or hidden UI control cannot grant access.

5. Test the module and app with `npm run test:spacetimedb`, `npm test`, `npm run typecheck`,
  `npm run lint`, and `npm run build`. The module harness tests reducer authorization and
  sender-filtered views; live subscription delivery requires the local service and two browser
  sessions.

For a separate cloud deployment, authenticate in the local CLI, register Maincloud, and
publish a separate database:

```bash
spacetime server add interlock-maincloud --url https://maincloud.spacetimedb.com
spacetime publish --server interlock-maincloud --module-path spacetimedb interlock-incidents-prod
spacetime generate --lang typescript --out-dir lib/spacetime/module_bindings --module-path spacetimedb
```

Set `NEXT_PUBLIC_SPACETIMEDB_URI=https://maincloud.spacetimedb.com` and
`NEXT_PUBLIC_SPACETIMEDB_DATABASE=interlock-incidents-prod` in the frontend host's environment,
then deploy the Next.js site separately. A database at `localhost` is only reachable from the
developer's machine and cannot serve a remote Vercel site. Cloud login, publishing, and
deployment are not run here.

The implementation follows the [SpacetimeDB TypeScript client reference](https://spacetimedb.com/docs/clients/typescript),
[private table/view access guidance](https://spacetimedb.com/docs/tables/access-permissions),
[reducer testing guide](https://spacetimedb.com/docs/how-to/unit-testing), and
[CLI reference](https://spacetimedb.com/docs/cli-reference) for the 2.x SDK.

```bash
npm test          # campaign, engine, demo, live speech, auth, consent and Twilio tests
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
app/              Next.js routes — landing, demo, simulated operator console, evidence, network
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
lib/spacetime/    Generated SpacetimeDB client bindings
spacetimedb/      Durable incident tables, views, reducers, and module tests
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

## Live calls, accounts and consent

### Live call protection (`/live`)

A real, unscripted conversation scored sentence by sentence:

1. The customer opts in on the page (analysis, everyone-on-the-call-was-told, and who
   processes the audio). Signed-in customers also need *Live call analysis* switched on.
2. **Microphone mode** — the browser's Web Speech API transcribes the call on speaker. Works in
   Chrome, Edge and Safari (Chrome sends audio to Google's speech service; disclosed on screen).
   A typing fallback covers browsers without it.
   **Phone mode** — a teammate dials the Twilio number; Interlock plays a spoken notice, starts
   Twilio real-time transcription on separate caller/customer tracks, and forwards the call to
   the customer's phone. Each utterance is POSTed to `/api/twilio/transcription`; the page polls
   for it. Texts to the same number appear as live messages. No WebSocket server is needed.
3. Each finished sentence becomes a `live_transcript` event in the existing kill-chain engine,
   on the device. Only the caller's words are scored.
4. Warnings escalate with the tier, quote what was heard, flag code requests, state confidence,
   and always offer **End the call / Check with the real company / Keep talking**.
5. Ending produces a plain-language incident report: summary, the customer's response, next
   steps, a clearly simulated 72-hour watch, and a link-free alert-email mock-up. The customer
   chooses whether to save it, report a fingerprint to the network, download it, or none.

### Accounts and consent

`/signup`, `/signin`, `/onboarding`, `/account` (dashboard + incident history),
`/account/privacy` (every consent switch, default **off**, with a timestamped log),
`/account/security` (activity, JSON export, account deletion), `/privacy` (notice).
Passwords are scrypt-hashed; sessions are HMAC-signed httpOnly cookies; `/account/*` is guarded
on the server. Revoking call analysis ends a running live session on its next poll; turning
off report-keeping deletes saved reports. Training-data sharing is shown but not offered.

### Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `AUTH_SECRET` | Sign-in | 32+ random characters. Without it sessions reset on restart. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` (or Vercel KV `KV_REST_API_URL` / `_TOKEN`) | Durable accounts and phone mode on serverless | Without it everything is in memory per instance. |
| `TWILIO_AUTH_TOKEN` | Phone mode | Every webhook is signature-checked with it. |
| `TWILIO_PHONE_NUMBER` | Phone mode | Shown on `/live`, e.g. `+15125550100`. |
| `INTERLOCK_FORWARD_TO` | Phone mode | The customer's real phone, E.164. Trial accounts can only dial verified numbers. |
| `LIVE_ARM_CODE` | Public deployments | A short code required to arm the shared number, so strangers cannot. |
| `INTERLOCK_KNOWN_NUMBERS` | Optional | Comma-separated "saved contacts" — calls/texts from these are never transcribed. |
| `PUBLIC_BASE_URL` | Optional | Public origin for Twilio callbacks if the proxy rewrites the host. |

Twilio console: set the number's **Voice** webhook to `POST https://<site>/api/twilio/voice`
and **Messaging** webhook to `POST https://<site>/api/twilio/sms`. A trial account (free
credit, one number) works for the demo; it plays a short trial message first and can only
forward to verified numbers.

## Honest limits

- **Voice only inside a live session.** A website cannot hear an ordinary call. Calls are
  analysed only when the customer starts a live session (microphone on speaker, or the
  Twilio demo number). Speech-recognition errors, accents and noise lower recall; there is no
  deepfake detection.
- **The scoring model is English-only**, so the Spanish interface currently explains an
  English-trained decision.
- **Synthetic data only.** Real base rates and false-positive burden will differ.
- **A real bank fraud alert looks a lot like a fake one.** We have a threshold, a cost
  estimate and a response designed to help rather than block. Not a solution.
- **Nothing touches a real account.** The circuit breaker holds a simulated action, and the
  72-hour watch after an incident is labelled simulated. Without Redis configured, accounts
  and live phone sessions are in-memory and reset when the server recycles.

The `/limits` page carries the full version, including the threat model against our own
system and what we deliberately chose not to build.

## Licence

Code is MIT. The synthetic corpus is fiction authored for this project and carries no real
person's data.
