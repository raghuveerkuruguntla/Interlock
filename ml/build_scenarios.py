"""Turn the v3 corpus into replayable Interlock threads.

Writes `public/data/corpus.json`, fetched on demand by the demo rather than
bundled, so the app's first paint does not pay for 336 scenarios.

What this deliberately does NOT carry into the app:
  * `label_for_evaluation_only` is kept, but only so the evaluation page can
    score replays. The engine is never handed it. The data card is explicit
    that hindsight labels must never reach inference, and the split between
    `events` (what was observable) and `label` (what we know in hindsight) is
    the mechanism that keeps that true.
  * `expected_initial_decision` / `expected_final_response` are dropped
    entirely. They are authoring notes, and leaving them in the payload would
    invite exactly the kind of accidental leakage the corpus was built to test.

Usage:  python -I ml/build_scenarios.py
"""

from __future__ import annotations

import ast
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "public" / "data"

# v3 channel vocabulary -> Interlock channel vocabulary.
CHANNEL = {
    "sms": "sms",
    "rcs": "rcs",
    "customer_response": "customer",
    "user_call_summary": "customer",
    "call_metadata_only": "call",
}

FAMILY_LABELS = {
    "carrier_line": "Phone line takeover",
    "bank_alert": "Bank alert",
    "delivery": "Package delivery",
    "road_toll": "Road toll",
    "recruiter": "Job offer",
    "resale": "Buying and selling",
    "family_emergency": "Family emergency",
    "tech_support": "Tech support",
    "health_bill": "Medical bill",
    "rent": "Rent and housing",
    "school": "School",
    "utility": "Utilities",
    "wrong_number": "Wrong number",
    "charity": "Charity",
    "government": "Government",
    "social_media_account": "Social account",
    "voice_emergency": "Emergency call",
    "qr_payment": "QR payment",
    "verification_code": "Verification code",
    "travel_change": "Travel change",
    "unknown_or_hard_negative": "Hard negative",
}


def read(name: str) -> list[dict[str, str]]:
    with (DATA / name).open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def to_event(row: dict[str, str], index: int) -> dict:
    """Map one corpus event onto a ThreadEvent.

    The `consented_call_summary` type matters here. It is a fictional
    customer-supplied summary of a call, with `actor=customer`. It is NOT an
    automatic transcription and Interlock must not present it as one, so it is
    carried as something the customer told us, not as call content.
    """
    kind = "message"
    actor = row["actor"]
    label = None

    if row["event_type"] == "consented_call_summary":
        # Carried as a customer account of a call, never as call content.
        kind = "customer_call_summary"
        label = "You told us about this call"
    elif row["event_type"] == "user_report":
        label = "What you did"

    return {
        "id": row["event_id"],
        "at": int(row["seconds_from_start"] or 0),
        "channel": CHANNEL.get(row["channel"], "sms"),
        "actor": "external" if actor == "external" else "customer",
        "kind": kind,
        "text": row["content"] or None,
        **({"label": label} if label else {}),
    }


def main() -> int:
    scenarios = read("v3_scenarios.csv")
    events = read("v3_events.csv")

    by_scenario: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in events:
        by_scenario[row["scenario_id"]].append(row)
    for rows in by_scenario.values():
        rows.sort(key=lambda r: int(r["seq"]))

    out_scenarios = []
    for s in scenarios:
        rows = by_scenario.get(s["scenario_id"], [])
        if not rows:
            continue
        out_scenarios.append(
            {
                "id": s["scenario_id"],
                "pairId": s["matched_pair_id"] or None,
                "family": s["family"],
                "familyLabel": FAMILY_LABELS.get(s["family"], s["family"]),
                "split": s["split"],
                # Hindsight only. Used by the evaluation page to score replays.
                # Never handed to the engine.
                "label": s["label_for_evaluation_only"],
                "channel": s["channel"],
                "events": [to_event(r, i) for i, r in enumerate(rows)],
            }
        )

    # Matched counterfactual pairs: identical first message, divergent ending.
    # These are the strongest demo material in the corpus, because they make a
    # shallow "the opener was suspicious" detector visibly wrong.
    pairs = []
    grouped: dict[str, list[dict]] = defaultdict(list)
    for s in out_scenarios:
        if s["pairId"]:
            grouped[s["pairId"]].append(s)
    for pair_id, members in grouped.items():
        scam = next((m for m in members if m["label"] == "scam"), None)
        other = next((m for m in members if m["label"] != "scam"), None)
        if not scam or not other:
            continue
        first_scam = next((e["text"] for e in scam["events"] if e["text"]), "")
        first_other = next((e["text"] for e in other["events"] if e["text"]), "")
        pairs.append(
            {
                "pairId": pair_id,
                "family": scam["family"],
                "familyLabel": scam["familyLabel"],
                "split": scam["split"],
                "identicalOpening": first_scam == first_other,
                "opening": first_scam,
                "scamId": scam["id"],
                "benignId": other["id"],
            }
        )

    pairs.sort(key=lambda p: (not p["identicalOpening"], p["pairId"]))

    payload = {
        "note": (
            "Synthetic corpus, authored for this project. Not real customer "
            "traffic and not an estimate of it."
        ),
        "generatedBy": "ml/build_scenarios.py",
        "counts": {
            "scenarios": len(out_scenarios),
            "pairs": len(pairs),
            "identicalOpenings": sum(1 for p in pairs if p["identicalOpening"]),
        },
        "pairs": pairs,
        "scenarios": out_scenarios,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "corpus.json"
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    print(
        f"corpus.json  {path.stat().st_size / 1024:.1f} KB  "
        f"{len(out_scenarios)} scenarios, {len(pairs)} pairs "
        f"({payload['counts']['identicalOpenings']} with identical openings)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
