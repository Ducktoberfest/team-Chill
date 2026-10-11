"""Post-conversation automation: Gemma 4 reads a finished conversation and produces a summary,
classification, follow-up email and next actions; opens a ticket when a human is needed."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid

from app import db, llm, prompts

log = logging.getLogger("chilldesk.automation")
IDLE_SECONDS = 90  # voice/web conversations idle this long are treated as finished


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


async def analyze(conversation_id: str) -> dict | None:
    conv = db.one("SELECT * FROM conversations WHERE id = %s", (conversation_id,))
    if not conv or not any(m["role"] == "user" for m in conv["messages"]):
        return None
    reply = await llm.chat([
        {"role": "system", "content": prompts.analyst_prompt()},
        {"role": "user", "content": f"Kanal: {conv['channel']}\n\n{_transcript(conv['messages'])}"},
    ], json_schema=prompts.ANALYSIS_SCHEMA, thinking="low")
    text = reply.text.strip().removeprefix("```json").removesuffix("```").strip()
    analysis = json.loads(text)

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
        await asyncio.sleep(20)
        try:
            rows = await asyncio.to_thread(db.query,
                "SELECT id FROM conversations WHERE analysis IS NULL AND jsonb_array_length(messages) > 1 "
                "AND updated_at < now() - make_interval(secs => %s)", (IDLE_SECONDS,))
            for r in rows:
                await analyze(r["id"])
        except Exception:  # noqa: BLE001 - keep the loop alive
            log.exception("sweeper failed")
