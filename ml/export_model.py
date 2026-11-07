"""Train the Interlock message-level signal and export it for on-device inference.

Why this script exists
----------------------
Interlock scores message content in the browser. No message text crosses the
privacy boundary, so the model cannot live behind an API. This script fits the
same TF-IDF (word 1-2 + char 3-5) / logistic architecture that was validated in
the Safe Signal v3 package, then serialises the vocabulary, IDF weights and
coefficients to JSON that `lib/engine/scorer.ts` evaluates directly.

It also writes:
  * public/model/parity.json  - fixtures asserting the TS port matches sklearn
  * public/model/metrics.json - calibration, operating points, abstain band

Honest framing: this is a synthetic corpus. Every number produced here measures
performance on authored data from one project. It is not an estimate of
real-world traffic and must never be presented as one.

Usage:  python -I ml/export_model.py
"""

from __future__ import annotations

import csv
import json
import math
import sys
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.pipeline import FeatureUnion, Pipeline

SEED = 271828
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "public" / "model"

# Operating threshold and abstain band.
# The band is the range where the product asks a question instead of asserting
# a verdict. See docs/DETECTION.md for how these were chosen.
THRESHOLD = 0.54
ABSTAIN_LOW = 0.40
ABSTAIN_HIGH = 0.70

LABELS = ("scam", "legitimate", "unsolicited_nonfraud")


def read_csv(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def load_splits() -> dict[str, tuple[list[str], np.ndarray]]:
    """Reproduce the v3 split policy exactly.

    v1 contributes only final-event snapshots. v3 contributes whole-scenario
    observed text. Matched counterfactual pairs are assigned wholly to one
    split upstream, so no pair straddles train/validation/holdout.
    """
    v1 = [
        r
        for r in read_csv("model_snapshots.csv")
        if r["is_final_event"] == "1" and r["scenario_truth_for_eval_only"] in LABELS
    ]
    v3 = [
        r
        for r in read_csv("v3_scenarios.csv")
        if r["label_for_evaluation_only"] in LABELS and r["observed_external_text"]
    ]

    def batch(split: str, include_v1: bool = True) -> tuple[list[str], np.ndarray]:
        x: list[str] = []
        y: list[int] = []
        if include_v1:
            for r in v1:
                if r["split"] == split:
                    x.append(r["observed_text_so_far"])
                    y.append(int(r["scenario_truth_for_eval_only"] == "scam"))
        for r in v3:
            if r["split"] == split:
                x.append(r["observed_external_text"])
                y.append(int(r["label_for_evaluation_only"] == "scam"))
        return x, np.asarray(y, dtype=int)

    return {
        "train": batch("train"),
        "validation": batch("validation"),
        # The v1 test split was inspected during v1 development, so it is not a
        # blind benchmark. The holdout is v3-only and newly authored.
        "holdout": batch("holdout", include_v1=False),
    }


def load_challenge() -> tuple[list[str], np.ndarray]:
    rows = read_csv("v3_separately_authored_challenge.csv")
    # "ambiguous" cases carry no binary label by design and are excluded here;
    # they are exercised separately through the abstain path.
    rows = [r for r in rows if r["hindsight_label_eval_only"] in LABELS]
    x = [r["external_user_shared_text"] for r in rows]
    y = np.asarray([int(r["hindsight_label_eval_only"] == "scam") for r in rows], dtype=int)
    return x, y


def build_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "feats",
                FeatureUnion(
                    [
                        (
                            "word",
                            TfidfVectorizer(
                                ngram_range=(1, 2),
                                min_df=1,
                                max_features=22000,
                                sublinear_tf=True,
                            ),
                        ),
                        (
                            "char",
                            TfidfVectorizer(
                                analyzer="char",
                                ngram_range=(3, 5),
                                min_df=2,
                                max_features=25000,
                                sublinear_tf=True,
                            ),
                        ),
                    ]
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=2000, C=2.0, random_state=SEED, class_weight="balanced"
                ),
            ),
        ]
    )


def platt_fit(scores: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """Single sigmoid calibration, fitted on validation margins only.

    A one-parameter-pair sigmoid ports to TypeScript in three lines, which is
    why it is used here instead of sklearn's cross-validated calibrator (which
    would require shipping three separate models to the browser).
    """
    lr = LogisticRegression(C=1e10, solver="lbfgs", max_iter=5000)
    lr.fit(scores.reshape(-1, 1), y)
    return float(lr.coef_[0][0]), float(lr.intercept_[0])


def platt_apply(scores: np.ndarray, a: float, b: float) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-(a * scores + b)))


def confusion(p: np.ndarray, y: np.ndarray, thr: float) -> dict[str, float | int]:
    pred = (p >= thr).astype(int)
    tp = int(((pred == 1) & (y == 1)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())
    fp = int(((pred == 1) & (y == 0)).sum())
    tn = int(((pred == 0) & (y == 0)).sum())
    return {
        "threshold": round(thr, 4),
        "n": int(len(y)),
        "scams": int((y == 1).sum()),
        "benign": int((y == 0).sum()),
        "tp": tp,
        "fn": fn,
        "fp": fp,
        "tn": tn,
        "recall": round(tp / max(tp + fn, 1), 4),
        "false_positive_rate": round(fp / max(fp + tn, 1), 4),
        "precision": round(tp / max(tp + fp, 1), 4),
        "accuracy": round((tp + tn) / max(len(y), 1), 4),
    }


def reliability(p: np.ndarray, y: np.ndarray, bins: int = 10) -> dict:
    """Reliability diagram data plus expected and maximum calibration error.

    A model that says 0.8 should be right about 80% of the time. This is the
    number that actually drives whether a user should trust the warning, which
    is why Interlock reports it in place of a headline F1.
    """
    edges = np.linspace(0.0, 1.0, bins + 1)
    out = []
    ece = 0.0
    mce = 0.0
    n = len(y)
    for i in range(bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (p >= lo) & (p < hi) if i < bins - 1 else (p >= lo) & (p <= hi)
        count = int(mask.sum())
        if count == 0:
            out.append(
                {
                    "bin_low": round(float(lo), 2),
                    "bin_high": round(float(hi), 2),
                    "count": 0,
                    "mean_confidence": None,
                    "observed_rate": None,
                }
            )
            continue
        conf = float(p[mask].mean())
        obs = float(y[mask].mean())
        gap = abs(conf - obs)
        ece += (count / n) * gap
        mce = max(mce, gap)
        out.append(
            {
                "bin_low": round(float(lo), 2),
                "bin_high": round(float(hi), 2),
                "count": count,
                "mean_confidence": round(conf, 4),
                "observed_rate": round(obs, 4),
            }
        )
    return {
        "bins": out,
        "expected_calibration_error": round(ece, 4),
        "maximum_calibration_error": round(mce, 4),
        "brier": round(float(np.mean((p - y) ** 2)), 4),
    }


def abstain_report(p: np.ndarray, y: np.ndarray) -> dict:
    """How much of the set lands in the band where the product asks, not asserts."""
    band = (p >= ABSTAIN_LOW) & (p < ABSTAIN_HIGH)
    confident = ~band
    cp = (p[confident] >= THRESHOLD).astype(int)
    cy = y[confident]
    return {
        "band_low": ABSTAIN_LOW,
        "band_high": ABSTAIN_HIGH,
        "in_band": int(band.sum()),
        "in_band_share": round(float(band.mean()), 4),
        "in_band_scam_share": round(float(y[band].mean()), 4) if band.sum() else None,
        "confident_n": int(confident.sum()),
        "confident_accuracy": round(float((cp == cy).mean()), 4) if confident.sum() else None,
        "note": (
            "Inside the band Interlock asks a grounded question instead of "
            "asserting a verdict. Accuracy outside the band is what a user "
            "actually experiences as a stated verdict."
        ),
    }


def main() -> int:
    splits = load_splits()
    x_train, y_train = splits["train"]
    x_val, y_val = splits["validation"]
    x_hold, y_hold = splits["holdout"]
    x_chal, y_chal = load_challenge()

    print(
        f"train={len(x_train)}  validation={len(x_val)}  holdout={len(x_hold)}  "
        f"challenge={len(x_chal)}",
        file=sys.stderr,
    )

    pipe = build_pipeline()
    pipe.fit(x_train, y_train)

    margin_val = pipe.decision_function(x_val)
    a, b = platt_fit(margin_val, y_val)

    def prob(texts: list[str]) -> np.ndarray:
        return platt_apply(pipe.decision_function(texts), a, b)

    p_val, p_hold, p_chal = prob(x_val), prob(x_hold), prob(x_chal)

    # ---- serialise the model -------------------------------------------------
    union: FeatureUnion = pipe.named_steps["feats"]
    word: TfidfVectorizer = dict(union.transformer_list)["word"]
    char: TfidfVectorizer = dict(union.transformer_list)["char"]
    clf: LogisticRegression = pipe.named_steps["clf"]

    def terms_in_order(vec: TfidfVectorizer) -> list[str]:
        ordered = sorted(vec.vocabulary_.items(), key=lambda kv: kv[1])
        return [t for t, _ in ordered]

    n_word = len(word.vocabulary_)
    coef = clf.coef_[0]

    model = {
        "format": "interlock-tfidf-logreg-v1",
        "note": (
            "Vocabulary, IDF and coefficients for on-device scoring. Evaluated "
            "by lib/engine/scorer.ts. Trained on synthetic data only."
        ),
        "word": {
            "ngram": [1, 2],
            "terms": terms_in_order(word),
            "idf": [round(float(v), 6) for v in word.idf_],
        },
        "char": {
            "ngram": [3, 5],
            "terms": terms_in_order(char),
            "idf": [round(float(v), 6) for v in char.idf_],
        },
        "coefWord": [round(float(v), 6) for v in coef[:n_word]],
        "coefChar": [round(float(v), 6) for v in coef[n_word:]],
        "intercept": round(float(clf.intercept_[0]), 6),
        "platt": {"a": round(a, 6), "b": round(b, 6)},
        "threshold": THRESHOLD,
        "abstain": {"low": ABSTAIN_LOW, "high": ABSTAIN_HIGH},
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "model.json").write_text(
        json.dumps(model, separators=(",", ":"), ensure_ascii=False), encoding="utf-8"
    )

    # ---- parity fixtures -----------------------------------------------------
    # The TypeScript port must reproduce these probabilities. Deliberately
    # includes whitespace runs, newlines, unicode and punctuation, because those
    # are exactly where a hand-written TF-IDF implementation drifts from sklearn.
    fixture_texts = (
        x_hold[:40]
        + x_chal[:20]
        + [
            "Reply with the verification code to stop the change.",
            "There is a pending change on the mobile line ending 42.",
            "  multiple   spaces\tand\ttabs  between   words  ",
            "line one\nline two\n\n\nline four",
            "Café naïve résumé — em dash, 'curly quotes', 100% off!!!",
            "SHOUTING IN ALL CAPS ABOUT YOUR ACCOUNT",
            "a",
            "ab",
            "",
            "https://t-mobi1e-secure.example.com/verify?id=99",
        ]
    )
    fixture_probs = prob([t for t in fixture_texts])
    margins = pipe.decision_function([t for t in fixture_texts])
    parity = {
        "note": "Generated by ml/export_model.py. tests/scorer.parity.test.ts asserts these.",
        "tolerance": 1e-4,
        "cases": [
            {"text": t, "margin": round(float(m), 6), "probability": round(float(p), 6)}
            for t, m, p in zip(fixture_texts, margins, fixture_probs)
        ],
    }
    (OUT / "parity.json").write_text(
        json.dumps(parity, indent=1, ensure_ascii=False), encoding="utf-8"
    )

    # ---- metrics -------------------------------------------------------------
    def block(name: str, p: np.ndarray, y: np.ndarray, desc: str) -> dict:
        return {
            "name": name,
            "description": desc,
            "operating_point": confusion(p, y, THRESHOLD),
            "sweep": {
                str(t): confusion(p, y, t) for t in (0.3, 0.4, 0.5, 0.54, 0.6, 0.7, 0.8, 0.9)
            },
            "roc_auc": round(float(roc_auc_score(y, p)), 4),
            "pr_auc": round(float(average_precision_score(y, p)), 4),
            "calibration": reliability(p, y),
            "abstain": abstain_report(p, y),
        }

    metrics = {
        "generated_by": "ml/export_model.py",
        "corpus": "Safe Signal v3 synthetic corpus (authored, not real traffic)",
        "honest_limits": [
            "Every figure here is measured on synthetic, authored text.",
            "Families, names and sentence structure recur across splits, so these numbers are optimistic.",
            "The separately-authored challenge set is from the same project and is not external validation.",
            "Real-world base rates and false-positive burden will differ, possibly a lot.",
        ],
        "threshold": THRESHOLD,
        "threshold_selection": (
            "Chosen on validation only, targeting a low false-positive rate. "
            "Never re-selected on the holdout or the challenge set."
        ),
        "splits": {
            "train": int(len(y_train)),
            "validation": int(len(y_val)),
            "holdout": int(len(y_hold)),
            "challenge": int(len(y_chal)),
        },
        "sets": [
            block(
                "validation",
                p_val,
                y_val,
                "Used to pick the threshold and fit calibration. Not a blind test.",
            ),
            block(
                "holdout",
                p_hold,
                y_hold,
                "Newly authored v3 scenarios, never used for fitting or threshold choice.",
            ),
            block(
                "challenge",
                p_chal,
                y_chal,
                "65 separately-authored short messages written before scoring. Same project, so not external.",
            ),
        ],
    }
    (OUT / "metrics.json").write_text(
        json.dumps(metrics, indent=1, ensure_ascii=False), encoding="utf-8"
    )

    size_kb = (OUT / "model.json").stat().st_size / 1024
    print(f"model.json      {size_kb:8.1f} KB  ({n_word} word + {len(char.vocabulary_)} char features)")
    for s in metrics["sets"]:
        op = s["operating_point"]
        cal = s["calibration"]
        print(
            f"{s['name']:<12} n={op['n']:<4} recall={op['recall']:.3f} "
            f"fpr={op['false_positive_rate']:.3f} prec={op['precision']:.3f} "
            f"auc={s['roc_auc']:.3f} ece={cal['expected_calibration_error']:.4f}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
