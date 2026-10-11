"""Evaluate Gemma 4 E2B on the held-out test set, base or with the fine-tuned LoRA adapter.

    .venv/bin/python eval_local.py --name base
    .venv/bin/python eval_local.py --name finetuned --adapter out/chilldesk-analyst-lora
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from unsloth import FastModel  # noqa: I001
import torch

from common import load, prompt, score

OUT = Path(__file__).parent / "out"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--model", default="unsloth/gemma-4-E2B-it")
    ap.add_argument("--adapter")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    model, tok = FastModel.from_pretrained(a.adapter or a.model, max_seq_length=2048, load_in_4bit=True)
    FastModel.for_inference(model)
    tok = getattr(tok, "tokenizer", tok)
    rows = load("test")[: a.limit or None]
    outputs, times = [], []
    for i, row in enumerate(rows):
        text = tok.apply_chat_template([{"role": "user", "content": prompt(row)}], tokenize=False, add_generation_prompt=True)
        ids = tok(text, return_tensors="pt").to(model.device)
        t0 = time.time()
        with torch.no_grad():
            gen = model.generate(**ids, max_new_tokens=220, do_sample=False)
        times.append(time.time() - t0)
        outputs.append(tok.decode(gen[0][ids["input_ids"].shape[1]:], skip_special_tokens=True))
        if i < 2:
            print(outputs[-1][:300])
    res = score(rows, outputs)
    res.update({"name": a.name, "model": a.model, "adapter": a.adapter, "sec_per_example": sum(times) / len(times)})
    OUT.mkdir(exist_ok=True)
    (OUT / f"results_{a.name}.json").write_text(json.dumps({"metrics": res, "outputs": outputs}, ensure_ascii=False, indent=1))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
