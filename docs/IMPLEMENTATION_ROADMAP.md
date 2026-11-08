# Interlock — implementation audit and next build priorities

Updated: 2026-11-07 · Scope: T-Mobile Scam & Fraud Challenge, synthetic-only prototype.
Inputs: repository source review and the accompanying *Breakpoint — T-Mobile Scam & Fraud Challenge: Complete Build Plan* (17 pages).

## Current product boundary

This app is a research prototype. Nothing below authorizes a real carrier account hold,
message interception, live call analysis, or real customer data collection.

### Already implemented in the repository

- Deterministic conversation-level risk state machine with stage-aware safeguards.
- Browser-side TF-IDF model inference and a scorer parity test against Python outputs.
- Synthetic scripted scenarios and a synthetic corpus library.
- OTP Guard and account-action interlock as **simulations**, not live carrier features.
- Grounded reasons, uncertainty/abstention behavior, decision receipts, and basic recovery guidance.
- In-memory SimHash campaign demo and synthetic evaluation, including adversarial and calibration evidence.
- English customer UI and light/dark mode. Browser-native zoom remains available.
- New editorial homepage, scroll reveals, looping pauseable preview, chronological demo input,
  auto-playing complete scripted scenarios with explicit end outcomes, replay/scrubbing,
  automatic conversation scrolling, and a simulated OTP countdown.
- Lovable-inspired interactive six-stage kill-chain explorer, with user-selectable stages,
  optional autoplay, and stage-specific explanations.
- Dedicated `/analyze` route using the **real local engine**, not placeholder scoring.
  Supports editable multi-turn text, sender vs customer role attribution, synthetic
  examples, signal explanations, safeguards and decision receipts.
- Dedicated Analyzer for a fresh fictional conversation; curated demo contains only the five scripted scenarios.
- Recovery action now starts the simulated guidance immediately, with optional refinement.
- Independent-verification and account-action hold interactions are explicitly simulated.

### Partial or demo-only — do not pitch as fully shipped

| Feature | Present behavior | Gap |
|---|---|---|
| OTP Guard | Local simulated code hold with 60-second countdown | No real OTP access or handset/call integration; hold can be bypassed |
| Circuit breaker | State machine recommends delay; UI acknowledges a proposed hold | No authenticated carrier-side account action, actual enforced delay or release policy |
| Independent verification | User can mark a sender verified | No cryptographically trusted brand registry or official-number verification workflow |
| Recovery | Customer can select exposure type; checklists appear | No real lock, session revocation, financial institution handoff, or pre-filled official report |
| Campaign network | Synthetic seeds + server-process in-memory reports | No durable shared storage, verified reporter identity, enforced rate limits or abuse review |
| Safe Peek | Displays parsed destination locally without navigation | No site rendering, safe-fetch isolation, URL/domain verification or reputation feed |
| Language accessibility | English UI only | Non-English support not currently exposed; English-trained model coverage is limited |

## P0 — fix before judging

1. **Demo reliability and walkthrough**  
   Every scenario must play to completion and display a distinct end state. Verify play,
   pause, replay, step, scrub, 1×/2× speed, manual incoming message, manual reply, and
   recovery selection at desktop and mobile widths. Add browser-level E2E tests for
   all five featured scenarios and one corpus counterfactual pair. No scenario should
   silently end without a completion affordance. Keep a recorded fallback presentation.

2. **Product correctness and consent**  
   Introduce separate opt-ins for any simulated sensitive safeguard. Clarify that
   marking a sender verified is a **customer assertion**, not a successful independent
   brand authentication. Keep model scores separate from claims of verified safety,
   and never infer that an incoming message authorizes an account action.

3. **Demonstrate a full recovery path**  
   Show a simple, persistent action checklist based on the reported exposure:
   hang up, open the official app or manually dial a trusted number, change relevant
   credentials, contact a bank, and report the attempt. Label every simulated action
   explicitly; do not imply a real account was locked.

4. **Ship proof, not assertions**  
   Run typecheck, lint, unit tests, and production build on each PR. Add playback
   interaction tests, keyboard-only navigation checks, mobile visual QA, and
   reduced-motion checks. Rehearse the entire five-minute story.

## P1 — highest-value feature development

1. **Verified brand registry / independent verification:** A small reviewed list of
   official support channels with visible provenance, freshness, and source links.
   Never automatically dial a number supplied in the suspicious message.
2. **Actual phishing inspection:** A sandboxed link-preview/provenance service
   designed not to leak the user's browsing identity or fetch untrusted content
   inside the app origin. Domain age, similarity, and certificate signals must be
   sourced and independently checked before being displayed.
3. **Recovery report drafting:** Local, user-reviewed FTC/IC3 report templates.
   No data upload or submission without an explicit action. No fake "submitted" state.
4. **Campaign abuse resistance:** Durable storage, authenticated reporting,
   per-identity rate limits, deduplication, verified-brand protections, and review
   before any network-wide blocking. The in-memory sample must never be confused
   with validated campaign telemetry.
5. **Accessibility pass:** Screen reader walkthrough, 200% zoom, contrast, keyboard
   actions, touch targets, screen-reader announcements for changing risk and user
   control over animation.

## P2 — research / roadmap only

- Carrier account APIs, SIM/port-out holds and recovery orchestration.
- Cross-channel SMS/voice correlation and consent-based call insights.
- Voice deepfake detection, canary numbers, or real-time coaching.
- Trusted Circle with explicit enrollment, narrow notification scope and easy withdrawal.
- Privacy-reviewed evaluation using appropriately consented real-world examples.

## Acceptance checklist for the interactive demo

- [ ] First scenario reaches escalation, OTP hold, extraction, and optional recovery.
- [ ] User's inserted incoming message visibly appears at the correct time, and may affect scoring.
- [ ] User's reply visibly appears as their own message, not as an attacker message.
- [ ] Rewinding does not leak future messages into the present assessment.
- [ ] Playback after manual input is chronological and ends cleanly.
- [ ] Every short scenario is clearly labeled as short and has replay/next-step affordances.
- [ ] OTP countdown unlocks the fictional code at 60 seconds and resets on replay.
- [ ] Safe Peek never opens untrusted URLs or implies a live reputation lookup.
- [ ] Reporting shows what metadata is shared and whether the attempt succeeded.
- [ ] No Spanish toggle, English-only limits accurate.
- [ ] Responsive, keyboard, reduced-motion and dark-mode checks passed.
- [ ] All checks in CI are green before merging.

## Hackathon narrative

Open with the ambiguous notice, show isolation, let the OTP Guard fire, then the
account-action recommendation, and finish with recovery guidance. The pitch's
advantage is not an inflated probability: it is a clear safeguard placed at the
moment a customer could be harmed.

This plan follows the attached build document's scope cut: prioritize
kill-chain safeguards, recovery, readable explanations, adversarial evidence,
and a reliable live demo over broad, unverified new features.
