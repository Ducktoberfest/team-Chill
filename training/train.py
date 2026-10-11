"""QLoRA fine-tune of Gemma 3 1B for the ChillDesk analyst task with Unsloth.

    .venv/bin/python train.py --model unsloth/gemma-4-E2B-it --epochs 2
Saves the LoRA adapter to out/chilldesk-analyst-lora and the training log to out/train_log.json.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from unsloth import FastModel  # noqa: I001 - unsloth must be imported before transformers/trl
from datasets import Dataset
from trl import SFTConfig, SFTTrainer

from common import load, prompt, target

OUT = Path(__file__).parent / "out"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="unsloth/gemma-3-1b-it-unsloth-bnb-4bit")
    ap.add_argument("--epochs", type=float, default=2)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--max-len", type=int, default=2048)
    a = ap.parse_args()

    model, tok = FastModel.from_pretrained(a.model, max_seq_length=a.max_len, load_in_4bit=True)
    model = FastModel.get_peft_model(
        model, finetune_vision_layers=False, finetune_language_layers=True,
        finetune_attention_modules=True, finetune_mlp_modules=True,
        r=a.rank, lora_alpha=a.rank, lora_dropout=0, bias="none", random_state=7)
    tok = getattr(tok, "tokenizer", tok)  # multimodal processors wrap the text tokenizer

    def fmt(row):
        msgs = [{"role": "user", "content": prompt(row)}, {"role": "assistant", "content": target(row)}]
        return {"text": tok.apply_chat_template(msgs, tokenize=False)}

    train = Dataset.from_list([fmt(r) for r in load("train")])
    print(train[0]["text"][-400:])

    trainer = SFTTrainer(
        model=model, tokenizer=tok, train_dataset=train,
        args=SFTConfig(output_dir=str(OUT / "ckpt"), dataset_text_field="text", max_seq_length=a.max_len,
                       per_device_train_batch_size=2, gradient_accumulation_steps=4, num_train_epochs=a.epochs,
                       learning_rate=a.lr, lr_scheduler_type="cosine", warmup_ratio=0.05, logging_steps=5,
                       optim="adamw_8bit", weight_decay=0.01, seed=7, report_to="none", save_strategy="no"))
    # learn only the JSON answer, not the prompt
    try:
        from unsloth.chat_templates import train_on_responses_only
        probe = tok.apply_chat_template([{"role": "user", "content": "X"}, {"role": "assistant", "content": "Y"}], tokenize=False)
        user_tag = probe[: probe.index("X")].split("\n")[-1] or probe[: probe.index("X")][-30:]
        model_tag = probe[probe.index("X") + 1: probe.index("Y")]
        trainer = train_on_responses_only(trainer, instruction_part=user_tag, response_part=model_tag.lstrip())
        print("training on responses only:", repr(user_tag), repr(model_tag.lstrip()))
    except Exception as e:  # noqa: BLE001
        print("train_on_responses_only unavailable, training on full text:", e)

    t0 = time.time()
    stats = trainer.train()
    OUT.mkdir(exist_ok=True)
    model.save_pretrained(OUT / "chilldesk-analyst-lora")
    tok.save_pretrained(OUT / "chilldesk-analyst-lora")
    log = {"model": a.model, "train_examples": len(train), "epochs": a.epochs, "lr": a.lr, "lora_rank": a.rank,
           "seconds": round(time.time() - t0, 1), "final_loss": stats.training_loss,
           "loss_curve": [x for x in trainer.state.log_history if "loss" in x]}
    (OUT / "train_log.json").write_text(json.dumps(log, indent=1))
    print(json.dumps({k: v for k, v in log.items() if k != "loss_curve"}, indent=1))


if __name__ == "__main__":
    main()
