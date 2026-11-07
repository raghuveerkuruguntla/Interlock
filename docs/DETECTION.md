# Detection

Notes on the choices behind the numbers, for anyone reading the code or arguing with the
evidence page.

## Why there is a classifier at all, and why it is small

The baseline classifier was handed to every team in the challenge package precisely so that
the weekend would not be spent on modelling. Beating it by three F1 points proves very
little and costs a day. So it is used as **one signal inside a larger system**, and the time
went into calibration, the abstain zone, the adversarial suite and the thread-level machine
instead.

The architecture is unchanged from the validated v3 pipeline — a FeatureUnion of word (1-2)
and character (3-5) TF-IDF feeding a logistic regression. What changed is the calibration and
the serialisation:

- The original used `CalibratedClassifierCV(cv=3)`, which fits three separate pipelines and
  averages them. That would mean shipping three models to the browser. A single Platt sigmoid
  fitted on validation ports to TypeScript in three lines and performs equivalently on these
  splits.
- The vocabulary, IDF weights and coefficients are exported to JSON so inference can run on
  the device. The port is held to exact parity with scikit-learn by fixtures the training
  script emits.

## Why the model's contribution is capped

Two caps, both deliberate.

**A global cap of 0.5.** A text classifier that is certain, with no observable request
anywhere in the thread, can raise a thread to "be careful" and no further. It can never by
itself trigger a hold on an account. This is what makes prompt injection against the
explainer pointless — the model has no authority over the tier, so there is nothing for an
injected instruction to capture.

**A per-stage cap.** At `contact`, the model can carry a thread to 0.30 — "worth a look" —
and no further. This is not hedging. The corpus contains 160 matched pairs whose first
messages are byte-identical between a scam and a legitimate conversation, and our own
classifier rates one such opener at **0.914** when by construction it is a coin flip. A score
is not evidence yet at first contact, however confident it sounds. It takes an observed
request to get past that, and the cap lifts as the thread earns it.

## The threshold

0.54, chosen on validation only, targeting a low false-positive rate, and never re-selected
on the holdout or the challenge set. The sweep across thresholds is plotted on the evidence
page so the choice can be argued with rather than taken on trust.

## The abstain band

Between 0.40 and 0.70 the product does not assert — it asks. "Did you contact them first, or
did they contact you?" is a better response to genuine uncertainty than a red banner that
turns out to be wrong, and it attacks alert fatigue, which is the real reason warnings get
ignored.

The band only applies when nothing observable has fired. A thread containing a passcode
request is not ambiguous no matter what the classifier thinks.

## The negation guard

The single most important detail in `signals.ts`. The legitimate half of many matched pairs
ends with real safety advice — "we will never ask you to send us that verification code". A
naive keyword detector flags that as a code request and tells the customer their bank's
genuine advice is an attack.

The guard searches backwards only to the nearest clause boundary, so a negation in sentence
one cannot excuse a demand in sentence nine. Commas count as boundaries: without that,
"Do not verify with family, just wire the funds today" reads as negated and the wire request
is silently dropped — the guard protecting the attacker instead of the customer.

## What "caught" means

Three different numbers, deliberately not collapsed into one:

- **Asserted** — the thread reached a tier that shows a definite warning. This is what a
  person experiences as the product saying "this is a scam".
- **Intervened** — any safeguard added real friction. Broader, and the number that matters
  for whether a loss was actually prevented.
- **Abstained** — the product asked a question instead of asserting.

An action-guard flag means a dangerous-looking request was observed. It is not proof of
scam detection and not proof that harm was prevented; some scams never make an explicit
request at all.
