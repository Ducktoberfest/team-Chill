"""Shared prompt and scoring for the ChillDesk analyst task (train, eval and the app use the same format)."""
from __future__ import annotations

import json
import re
from pathlib import Path

DATA = Path(__file__).parent / "data"
FIELDS = ["category", "urgency", "sentiment", "resolved", "needs_human", "team"]

INSTRUCTION = """Onlayn mağaza "Mallard"ın müştəri dəstəyi söhbətini analiz et və YALNIZ JSON qaytar:
{"summary": "1-2 cümlə Azərbaycan dilində",
 "category": "delivery|returns|payment|product_question|technical|complaint|other",
 "urgency": "low|medium|high",
 "sentiment": "positive|neutral|negative"  (söhbətin SONUNDAKI əhval),
 "resolved": true|false  (agent söhbət ərzində tam həll edib),
 "needs_human": true|false,
 "team": "delivery|payments|returns|technical|management" və ya null (needs_human false olanda null)}

Söhbət:
"""


def load(name: str) -> list[dict]:
    return [json.loads(line) for line in open(DATA / f"{name}.jsonl", encoding="utf-8")]


def prompt(row: dict) -> str:
    return INSTRUCTION + row["transcript"]


def target(row: dict) -> str:
    lab = row["label"]
    return json.dumps({"summary": lab["summary"], **{k: lab[k] for k in FIELDS}}, ensure_ascii=False)


def parse(text: str) -> dict | None:
    """First JSON object in the model output, or None."""
    text = text.strip().removeprefix("```json").removeprefix("```").strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        out = json.loads(m.group(0))
        return out if isinstance(out, dict) else None
    except json.JSONDecodeError:
        return None


def score(rows: list[dict], outputs: list[str]) -> dict:
    n = len(rows)
    valid, correct = 0, {f: 0 for f in FIELDS}
    exact = 0
    for row, out in zip(rows, outputs):
        pred = parse(out)
        if pred is None:
            continue
        valid += 1
        ok_all = True
        for f in FIELDS:
            gold = row["label"][f]
            p = pred.get(f)
            if isinstance(gold, bool):
                p = p if isinstance(p, bool) else str(p).lower() == "true"
            hit = (p == gold) or (gold is None and p in (None, "null", ""))
            correct[f] += hit
            ok_all &= hit
        exact += ok_all
    res = {"n": n, "json_valid": valid / n, "all_fields_exact": exact / n}
    res.update({f"acc_{f}": correct[f] / n for f in FIELDS})
    res["acc_mean"] = sum(correct.values()) / (n * len(FIELDS))
    return res
