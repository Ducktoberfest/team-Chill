"""Local analyst service: our fine-tuned Gemma 3 1B + LoRA classifies a finished support conversation, offline, on the laptop GPU.

    cd training && .venv/bin/uvicorn serve_analyst:app --host 127.0.0.1 --port 8001
POST /analyze {"transcript": "MÜŞTƏRİ: ...\\nAGENT: ..."}  ->  {"category", "urgency", "sentiment", "resolved", "needs_human", "team", "summary"}
"""
from __future__ import annotations

import asyncio
import time
from pathlib import Path

from unsloth import FastModel  # noqa: I001 - unsloth must be imported before transformers
import torch
from fastapi import FastAPI
from pydantic import BaseModel

from common import parse, prompt

ADAPTER = Path(__file__).parent / "out" / "chilldesk-analyst-lora"
app = FastAPI(title="ChillDesk local analyst (Gemma 3 1B + LoRA)")
_model = _tok = None
_lock = asyncio.Lock()   # one generation at a time on the GPU


@app.on_event("startup")
def load() -> None:
    global _model, _tok
    _model, tok = FastModel.from_pretrained(str(ADAPTER), max_seq_length=2048, load_in_4bit=True)
    FastModel.for_inference(_model)
    _tok = getattr(tok, "tokenizer", tok)


class In(BaseModel):
    transcript: str


def _generate(transcript: str) -> tuple[str, float]:
    text = _tok.apply_chat_template([{"role": "user", "content": prompt({"transcript": transcript})}],
                                    tokenize=False, add_generation_prompt=True)
    ids = _tok(text, return_tensors="pt").to(_model.device)
    t0 = time.time()
    with torch.no_grad():
        out = _model.generate(**ids, max_new_tokens=220, do_sample=False)
    return _tok.decode(out[0][ids["input_ids"].shape[1]:], skip_special_tokens=True), time.time() - t0


@app.post("/analyze")
async def analyze(body: In):
    if _lock.locked():   # busy with another conversation: let the caller use the cloud result instead of queueing
        return {"result": None, "busy": True}
    async with _lock:
        raw, secs = await asyncio.to_thread(_generate, body.transcript[-6000:])
    return {"result": parse(raw), "seconds": round(secs, 2), "model": "Gemma 3 1B + ChillDesk LoRA"}


@app.get("/health")
def health():
    return {"ok": _model is not None}
