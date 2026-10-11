"""Generate a labelled Azerbaijani support-conversation dataset for the ChillDesk analyst task.

Labels are sampled first and the teacher model (Gemma 4 26B on the Gemini API) writes a conversation that
matches them, so the ground truth is known by construction.

    ../backend/.venv/bin/python gen_data.py --n 360
"""
from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app import config, llm  # noqa: E402

OUT = Path(__file__).parent / "data"
CATEGORIES = ["delivery", "returns", "payment", "product_question", "technical", "complaint", "other"]
TEAM_FOR = {"delivery": "delivery", "returns": "returns", "payment": "payments", "technical": "technical",
            "complaint": "management", "product_question": "management", "other": "management"}
PRODUCTS = ["SoundWave Pro simsiz qulaqlıq", "Nova X12 smartfon", "Nova X12 silikon örtük", "AeroBook 14 noutbuk",
            "FrostLine 300L soyuducu", "BrewMate espresso maşını", "Kətan yataq dəsti", "Keramik qab dəsti",
            "Qış gödəkçəsi", "FitPulse 3 smart saat", "CleanBot S robot tozsoran", "RGB oyun siçanı"]
SITUATIONS = {
    "delivery": ["sifariş gecikir", "kuryer gəlmədi", "ünvanı dəyişmək istəyir", "izləmə nömrəsi işləmir", "çatdırılma vaxtını soruşur"],
    "returns": ["məhsul zədəli gəlib", "səhv məhsul gəlib", "fikrini dəyişib, qaytarmaq istəyir", "qaytarmanın statusunu soruşur"],
    "payment": ["kartdan iki dəfə pul çıxılıb", "promo kod işləmir", "hissə-hissə ödəniş haqqında soruşur", "pul qaytarılması gecikir"],
    "product_question": ["iki məhsulu müqayisə edir", "zəmanət müddətini soruşur", "stokda olub-olmadığını soruşur"],
    "technical": ["saytda ödəniş səhifəsi açılmır", "tətbiqə daxil ola bilmir", "SMS kodu gəlmir"],
    "complaint": ["kuryerin davranışından şikayət edir", "əməkdaşın cavabından narazıdır", "çoxsaylı problemlərdən bezib"],
    "other": ["iş saatlarını soruşur", "korporativ satış haqqında soruşur", "təşəkkür edir və təklif verir"],
}
STYLES = ["nəzakətli", "qısa və tələsik", "əsəbi", "yaşlı, çaşqın", "danışıq dilində, səhvlərlə", "rus sözləri qarışıq"]

GEN_PROMPT = """Sən sintetik data yaradırsan. "Mallard" onlayn mağazasının (Azərbaycan) müştəri dəstəyi chat-ini yaz.
Söhbət MÜŞTƏRİ və AGENT (Aysu) arasındadır, Azərbaycan dilində, real və təbii. {turns} replika.

Söhbət bu xüsusiyyətlərə TAM uyğun olmalıdır:
- mövzu (kateqoriya): {category} — konkret vəziyyət: {situation}
- məhsul: {product}
- müştərinin üslubu: {style}
- təcililik: {urgency} (high = pul itkisi, zədə, təhlükəsizlik və ya çox əsəbi müştəri; low = sadə sual)
- söhbətin SONUNDA müştərinin əhvalı: {sentiment}
- agent məsələni söhbət ərzində həll edib: {resolved}
- insan əməkdaş lazımdır (agent bilet açıb və ya açmalıdır): {needs_human}

Sətirlər "MÜŞTƏRİ: ..." və "AGENT: ..." formatında olsun. Etiketləri söhbətin içində açıq yazma.
Cavabı DƏQİQ bu formatda ver, başqa heç nə yazma:
<transcript>
MÜŞTƏRİ: ...
AGENT: ...
</transcript>
<summary>1-2 cümləlik xülasə: müştəri nə istədi, nə edildi</summary>"""



def sample_labels(rng: random.Random) -> dict:
    category = rng.choice(CATEGORIES)
    urgency = rng.choices(["low", "medium", "high"], [3, 4, 3])[0]
    if category == "complaint":
        urgency = rng.choice(["medium", "high"])
    resolved = rng.random() < 0.55
    needs_human = (not resolved) and rng.random() < 0.8 or (category == "complaint" and rng.random() < 0.6)
    if needs_human:
        resolved = False
    sentiment = rng.choices(["positive", "neutral", "negative"],
                            [5, 3, 1] if resolved else [1, 3, 5])[0]
    return {"category": category, "urgency": urgency, "sentiment": sentiment, "resolved": resolved,
            "needs_human": needs_human, "team": TEAM_FOR[category] if needs_human else None}


async def one(i: int, rng: random.Random, sem: asyncio.Semaphore) -> dict | None:
    labels = sample_labels(rng)
    prompt = GEN_PROMPT.format(turns=rng.choice(["4-6", "6-8", "8-10"]), situation=rng.choice(SITUATIONS[labels["category"]]),
                               product=rng.choice(PRODUCTS), style=rng.choice(STYLES), **labels)
    async with sem:
        for attempt in range(3):
            try:
                r = await asyncio.wait_for(llm.chat([{"role": "user", "content": prompt}]), timeout=60)
                tr = re.search(r"<transcript>(.*?)</transcript>", r.text, re.S)
                sm = re.search(r"<summary>(.*?)</summary>", r.text, re.S)
                if tr and sm and tr.group(1).count("MÜŞTƏRİ") >= 2:
                    return {"id": i, "transcript": tr.group(1).strip(), "label": {"summary": sm.group(1).strip(), **labels}}
            except Exception as e:  # noqa: BLE001
                print(f"[{i}] retry {attempt}: {str(e)[:120]}", flush=True)
                await asyncio.sleep(2 + attempt * 3)
    return None


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=360)
    ap.add_argument("--concurrency", type=int, default=12)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    rng = random.Random(a.seed)
    sem = asyncio.Semaphore(a.concurrency)
    tasks = [one(i, random.Random(rng.random()), sem) for i in range(a.n)]
    rows, done = [], 0
    for fut in asyncio.as_completed(tasks):
        r = await fut
        done += 1
        if r:
            rows.append(r)
        if done % 20 == 0:
            print(f"{done}/{a.n} done, {len(rows)} ok", flush=True)
    rows.sort(key=lambda r: r["id"])
    rng.shuffle(rows)
    n_test = max(40, len(rows) // 6)
    OUT.mkdir(exist_ok=True)
    for name, part in (("test", rows[:n_test]), ("train", rows[n_test:])):
        with open(OUT / f"{name}.jsonl", "w", encoding="utf-8") as f:
            for r in part:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"teacher: {config.GEMINI_MODEL} | train {len(rows) - n_test} | test {n_test}")


if __name__ == "__main__":
    asyncio.run(main())
