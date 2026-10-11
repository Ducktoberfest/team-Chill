"""Reference score: the large model (Gemma 4 26B on the Gemini API) on the same test set and prompt.

    ../backend/.venv/bin/python eval_teacher.py
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app import config, llm  # noqa: E402

from common import load, prompt, score  # noqa: E402

OUT = Path(__file__).parent / "out"


async def main() -> None:
    rows = load("test")
    sem = asyncio.Semaphore(10)
    times: list[float] = []

    async def one(row):
        async with sem:
            for attempt in range(3):
                try:
                    t0 = time.time()
                    r = await asyncio.wait_for(llm.chat([{"role": "user", "content": prompt(row)}]), timeout=60)
                    times.append(time.time() - t0)
                    return r.text
                except Exception:  # noqa: BLE001
                    await asyncio.sleep(2 + attempt * 3)
            return ""

    outputs = await asyncio.gather(*(one(r) for r in rows))
    res = score(rows, outputs)
    res.update({"name": "teacher", "model": config.GEMINI_MODEL, "sec_per_example": sum(times) / max(1, len(times))})
    OUT.mkdir(exist_ok=True)
    (OUT / "results_teacher.json").write_text(json.dumps({"metrics": res, "outputs": outputs}, ensure_ascii=False, indent=1))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    asyncio.run(main())
