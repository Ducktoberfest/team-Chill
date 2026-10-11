"""Build training/REPORT.md and training/report.png from the eval results (for the README and slides).

    .venv/bin/python report.py
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

HERE = Path(__file__).parent
OUT = HERE / "out"
RUNS = [("base", "Gemma 4 E2B (base)"), ("finetuned", "Gemma 4 E2B + ChillDesk LoRA"), ("teacher", "Gemma 4 26B (API, reference)")]
METRICS = [("json_valid", "Valid JSON"), ("acc_category", "Category"), ("acc_urgency", "Urgency"), ("acc_sentiment", "Sentiment"),
           ("acc_resolved", "Resolved"), ("acc_needs_human", "Needs human"), ("acc_team", "Team"), ("all_fields_exact", "All fields exact")]
COLORS = {"base": "#9aa5a3", "finetuned": "#0b7a5c", "teacher": "#f97316"}


def main() -> None:
    res = {k: json.loads((OUT / f"results_{k}.json").read_text())["metrics"] for k, _ in RUNS if (OUT / f"results_{k}.json").exists()}
    log = json.loads((OUT / "train_log.json").read_text()) if (OUT / "train_log.json").exists() else {}

    # grouped bars, one group per metric
    fig, ax = plt.subplots(figsize=(11, 4.6), dpi=160)
    keys = [k for k, _ in RUNS if k in res]
    w = 0.8 / len(keys)
    for i, k in enumerate(keys):
        vals = [res[k][m] * 100 for m, _ in METRICS]
        bars = ax.bar([x + i * w for x in range(len(METRICS))], vals, w, label=dict(RUNS)[k], color=COLORS[k])
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 1, f"{v:.0f}", ha="center", va="bottom", fontsize=7, color="#10242b")
    ax.set_xticks([x + w * (len(keys) - 1) / 2 for x in range(len(METRICS))], [n for _, n in METRICS], fontsize=9)
    ax.set_ylim(0, 110); ax.set_ylabel("% of test conversations")
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(frameon=False, fontsize=9, loc="upper left", ncols=len(keys))
    ax.set_title("ChillDesk analyst task — held-out Azerbaijani support conversations", fontsize=11, loc="left")
    fig.tight_layout(); fig.savefig(HERE / "report.png")

    if log.get("loss_curve"):
        fig, ax = plt.subplots(figsize=(5, 3), dpi=160)
        pts = [(p["step"], p["loss"]) for p in log["loss_curve"]]
        ax.plot(*zip(*pts), color=COLORS["finetuned"], lw=2)
        ax.set_xlabel("step"); ax.set_ylabel("training loss"); ax.spines[["top", "right"]].set_visible(False)
        fig.tight_layout(); fig.savefig(HERE / "loss.png")

    lines = ["# Fine-tuning Gemma 4 E2B for ChillDesk", "",
             "**Goal:** run ChillDesk's post-conversation analysis on a small, local, open-weight model (8 GB laptop GPU) "
             "instead of a large hosted model, without losing accuracy.", "",
             "**Task:** read an Azerbaijani customer-support conversation and return JSON with the summary, category (7), urgency (3), "
             "end sentiment (3), resolved, needs-human and routing team.", "",
             "**Data:** synthetic conversations written by Gemma 4 26B (teacher) from labels sampled *before* generation, so the "
             "ground truth is exact. The labels cover 7 categories × 3 urgencies × 3 sentiments, plus resolved/needs-human, 12 products and 6 customer styles "
             "(polite, rushed, angry, elderly, colloquial, mixed Russian). The test set is held out and never seen in training.", "",
             f"**Training:** Unsloth QLoRA (4-bit) on `{log.get('model', 'unsloth/gemma-4-E2B-it')}` · "
             f"{log.get('train_examples', '?')} examples · {log.get('epochs', '?')} epochs · LoRA rank {log.get('lora_rank', '?')} · "
             f"lr {log.get('lr', '?')} · loss on the JSON answer only · {log.get('seconds', '?')} s on an RTX 4070 Laptop (8 GB).", "",
             "## Results", "", "![results](report.png)", "",
             "| Metric | " + " | ".join(dict(RUNS)[k] for k in keys) + " |", "|---|" + "---|" * len(keys)]
    for m, name in METRICS + [("acc_mean", "Mean field accuracy")]:
        lines.append(f"| {name} | " + " | ".join(f"{res[k][m] * 100:.1f}%" for k in keys) + " |")
    lines.append("| Seconds / conversation | " + " | ".join(f"{res[k]['sec_per_example']:.2f}" for k in keys) + " |")
    lines += ["", f"Test set: {res[keys[0]]['n']} conversations.", ""]
    if (HERE / "loss.png").exists():
        lines += ["![loss](loss.png)", ""]
    lines += ["## Reproduce", "", "```bash", "cd training",
              "../backend/.venv/bin/python gen_data.py --n 360            # dataset (needs GEMINI_API_KEY)",
              ".venv/bin/python train.py                                  # Unsloth QLoRA",
              ".venv/bin/python eval_local.py --name base",
              ".venv/bin/python eval_local.py --name finetuned --adapter out/chilldesk-analyst-lora",
              "../backend/.venv/bin/python eval_teacher.py",
              ".venv/bin/python report.py", "```", ""]
    (HERE / "REPORT.md").write_text("\n".join(lines))
    print("\n".join(lines[lines.index("## Results"):]))


if __name__ == "__main__":
    main()
