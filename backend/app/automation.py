"""Post-conversation automation: Gemma 4 reads a finished conversation and produces a summary,
classification, follow-up email and next actions; opens a ticket when a human is needed."""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid

import httpx

from app import config, db, llm, prompts

log = logging.getLogger("chilldesk.automation")
IDLE_SECONDS = 10  # voice/web conversations idle this long are treated as finished (short for live demos)


def _transcript(messages: list[dict]) -> str:
    lines = []
    for m in messages:
        if m["role"] == "user":
            lines.append(f"MÜŞTƏRİ: {m.get('content', '')}")
        elif m["role"] == "assistant" and m.get("content"):
            lines.append(f"AGENT: {m['content']}")
        elif m["role"] == "tool":
            lines.append(f"[tool {m.get('name')}] {m.get('content', '')[:600]}")
    return "\n".join(lines)


LOCAL_FIELDS = ("category", "urgency", "sentiment", "resolved", "needs_human", "team")


async def _local_classify(messages: list[dict]) -> dict | None:
    """Our fine-tuned Gemma 3 1B (local GPU) classifies the conversation; None if the service is down or the output is unusable."""
    if not config.LOCAL_ANALYST_URL:
        return None
    lines = [f"{'MÜŞTƏRİ' if m['role'] == 'user' else 'AGENT'}: {m.get('content', '')}"
             for m in messages if m["role"] in ("user", "assistant") and m.get("content")]
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            r = await client.post(f"{config.LOCAL_ANALYST_URL}/analyze", json={"transcript": "\n".join(lines)})
        out = r.json().get("result") or {}
        return out if out.get("category") else None
    except Exception:  # noqa: BLE001 - the cloud analysis still covers everything
        log.warning("local analyst unavailable")
        return None


async def analyze(conversation_id: str) -> dict | None:
    conv = db.one("SELECT * FROM conversations WHERE id = %s", (conversation_id,))
    if not conv or not any(m["role"] == "user" for m in conv["messages"]):
        return None
    # cloud (Gemma 4 26B: summary, email, actions) and local (our 1B LoRA: classification) run in parallel
    cloud_call = llm.chat([
        {"role": "system", "content": prompts.analyst_prompt()},
        {"role": "user", "content": f"Kanal: {conv['channel']}\n\n{_transcript(conv['messages'])}"},
    ], json_schema=prompts.ANALYSIS_SCHEMA)
    cloud, local = await asyncio.gather(asyncio.wait_for(cloud_call, 45), _local_classify(conv["messages"]), return_exceptions=True)
    local = local if isinstance(local, dict) else None
    analysis = None
    if not isinstance(cloud, Exception):
        m = re.search(r"\{.*\}", cloud.text or "", re.S)   # Gemini JSON mode occasionally returns empty or wrapped text
        try:
            analysis = json.loads(m.group(0)) if m else None
        except json.JSONDecodeError:
            analysis = None
    if analysis is None:
        log.warning("cloud analysis unusable (%s); using %s", type(cloud).__name__, "local 1B" if local else "fallback")
        base = local or {"category": "other", "urgency": "medium", "sentiment": "neutral", "resolved": False,
                         "needs_human": True, "team": "management", "summary": "Avtomatik analiz alınmadı; əməkdaş baxmalıdır."}
        analysis = {**base, "action_items": [], "kb_gap": None, "follow_up_email": {"subject": "", "body": ""}}
    if local:
        analysis.update({k: local[k] for k in LOCAL_FIELDS if k in local})
        analysis["analyst"] = "Gemma 3 1B + LoRA (lokal)"

    agent_ticket = db.one("SELECT id FROM tickets WHERE conversation_id = %s LIMIT 1", (conversation_id,))
    if analysis.get("needs_human") and not agent_ticket:
        tid = "TK-" + uuid.uuid4().hex[:6].upper()
        priority = {"high": "P1", "medium": "P2"}.get(analysis.get("urgency"), "P3")
        db.execute("INSERT INTO tickets (id, conversation_id, customer_id, team, priority, summary, source) "
                   "VALUES (%s,%s,%s,%s,%s,%s,'automation')",
                   (tid, conversation_id, conv["customer_id"], analysis.get("team") or "management", priority, analysis["summary"]))
        analysis["auto_ticket"] = tid
    db.execute("UPDATE conversations SET analysis = %s, ended_at = coalesce(ended_at, now()) WHERE id = %s",
               (db.Jsonb(analysis), conversation_id))
    return analysis


async def sweeper() -> None:
    """Background loop: analyze conversations that went idle without being closed (e.g. voice calls)."""
    while True:
        await asyncio.sleep(5)
        try:
            rows = await asyncio.to_thread(db.query,
                "SELECT id FROM conversations WHERE analysis IS NULL AND jsonb_array_length(messages) > 1 "
                "AND updated_at < now() - make_interval(secs => %s)", (IDLE_SECONDS,))
            for r in rows:
                await analyze(r["id"])
        except Exception:  # noqa: BLE001 - keep the loop alive
            log.exception("sweeper failed")
