# Safe Signal synthetic corpus — Data card v3

## Purpose and provenance
A reproducible **synthetic engineering corpus** for preventing, containing and recovering from scam situations in a hackathon. Everything was hand-authored or programmatically varied from original author-written scenario families. No consumer records, real T-Mobile call/message feeds, real spam campaigns, actual account tokens, or proprietary data. Sources used to choose themes are public FTC, T-Mobile and FBI consumer guidance.

## Structure
- v1/v2: `scenarios.csv`, `events.csv`, `model_snapshots.csv`, `consumer_cases.csv`, `consumer_events.csv`, `stress_challenge_set.csv` (preserved from the prior work).
- v3: `v3_scenarios.csv`, `v3_events.csv` and `v3_counterfactual_cases.jsonl`. Scenarios carry a hindsight case label; events carry what was observable at that instant. Hindsight label and goal **must never** be used for inference.
- `v3_separately_authored_challenge.csv` includes deliberately different short wording. It is not part of model training or threshold selection.
- `v3_holdout_predictions.csv` / `v3_extra_predictions.csv` expose per-example misses and false alarms.

## Label axes (do not collapse them)
1. **Hindsight case class**: scam, legitimate, unsolicited_nonfraud, ambiguous (unknown; not assigned a binary label).
2. **Family**: carrier number takeover, bank, delivery, toll, job, resale, emergency impersonation, tech support, clinic, rental, school, utilities, wrong number, charity, government, social account, voice/call-summary situation, QR, OTP, travel.
3. **Observable tactic / requested action**: code request, card request, payment request, remote access, isolation/secrecy, urgency, unverified external link, investment pitch.
4. **Customer state**: no response, asks to verify, refuses, says they shared information, requests help. An allegation is not proof of theft.
5. **Exposure evidence**: unknown, customer reported, confirmed externally (not available), simulation only. The classifier must not infer third-party network receipt from a message alone.

## Paired placebos and chronology
**160 matched pairs have exactly identical first messages**, but one ends with a fraudulent action request while the other ends in legitimate guidance. This prevents a shallow detector from treating the opening as proof of fraud. Each pair is wholly assigned to a single train/validation/holdout split; there is no matched-pair cross-split leakage. However, families, names, and sentence structure do recur across splits, so accuracy can still be optimistic.

**No future leaking:** the text classifier trains only on the final visible external text from each scenario. It does not ingest customer recovery reports, hidden goals, case labels, model-provided signals, or future messages. The UI should compute a fresh decision after each event with only the messages observed so far.

## Evidence availability
- `sms` and `rcs`: invented message content **supplied into simulator**; not intercepted from a real inbox.
- `call_metadata_only`: content is **null**, not a fabricated transcript.
- `user_call_summary`: a **fictional customer-supplied summary**, with explicit `actor=customer`, `visibility=consented_customer_summary`. It is NOT an automatic transcription or something T-Mobile automatically sends.
- `customer_response`: consumer self-report; not a model ground truth or an authorization to send data.
- `account_event` (v1/v2): simulated backend-only state, not live carrier visibility.

## Train/evaluation policy
- The original 2026 v1 data train and validation splits are reused; original v1 test was historically inspected, so it is not represented as a new blind test.
- V3 matched-pair train (160 scenarios), validation (80), holdout (80 of 96 total; separate ambiguous/nonfraud controls fill out the remainder). The v3 holdout evaluation uses 40 scam + 50 nonfraud cases with visible text.
- V2 curated 46 labeled cases were **previously inspected**; their comparison is **development only**, not independent proof of improvement.
- Additional 65-case short-message challenge was written separately before it was scored. It is still original synthetic data from the same project and is not external validation.
- The operating threshold is 0.54, chosen from validation to target at most 8% false-positive rate. Holdout false positives are higher; threshold selection is **not** replayed on the holdout.

## Actual measurements (not carrier accuracy)

| Set | Scams / benign | Model recall | Model FPR | Action-guard coverage on scam | Action-guard benign interventions |
|---|---:|---:|---:|---:|---:|
| New V3 synthetic holdout | 40 / 50 | 25/40 = **62.5%** | 8/50 = **16.0%** | 38/40 = **95%** | 0/50 |
| Separately authored challenge | 30 / 27 | 28/30 = **93.3%** | 3/27 = **11.1%** | 10/30 = **33.3%** | 1/27 |
| Older V2 *development diagnostic*, old classifier at 0.90 | 26 / 20 | 4/26 = **15.4%** | 0/20 | — | — |
| Older V2 *development diagnostic*, updated classifier at **0.54** | 26 / 20 | 21/26 = **80.8%** | 0/20 | 12/26 | 0/20 |

**Important:** "Action guard coverage" means a suspicious instruction was flagged. It is NOT proof of scam detection and NOT proof harm was prevented; some scams never make explicit requests. Different tests have very different difficulty and style, hence the variation.

## Bias, missingness, harms and uncertainties
- Unrealistic synthetic language distribution; call metadata and text share are simplified.
- False positives can disrupt genuine account recovery or banking communication; never automatically freeze/lock an account from model output.
- Many threats are not represented: actual multilingual dialect diversity, network fraud telemetry, data-only malware, precise phone takeover workflows, accessibility constraints, payment authorization, camera screenshots, QR decoding, voice-clone audio verification.
- Never claim to know what a scammer exfiltrated unless an authorized source confirms it. Even a user self-report is a claim that must be labeled.
- Real-world performance cannot be inferred from these figures. Obtain consented, privacy-reviewed, licensed examples and red-team with independent reviewers before deployment.

## Error handling and future evaluation
Keep a failure log with case ID, last observable event, model score, safeguard status, whether any report consent existed, and suggested fix. If an example is used to revise rules/model, move it into development data; author an additional untouched evaluation suite before claiming improvement. Report separately early-warning recall, final-case recall, action-intervention rate, legitimate-friction rate, calibration and privacy/consent errors.
