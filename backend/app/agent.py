"""Aysu's tool-calling loop on Gemma 4, shared by web chat and the ElevenLabs voice channel."""
from __future__ import annotations

import asyncio
from typing import AsyncIterator

from app import db, llm, prompts, tools
from app.tools import Session

MAX_STEPS = 6


async def respond(s: Session, history: list[dict], user_msg: dict) -> AsyncIterator[dict]:
    """Run one customer turn. Yields events:
      {"type": "tool", "name", "label", "args", "result"}   after each tool call
      {"type": "text", "text"}                               the final answer (once)
    `history` is the prior conversation (no system message) and is extended in place."""
    customer = db.one("SELECT * FROM customers WHERE id = %s", (s.customer_id,)) if s.customer_id else None
    history.append(user_msg)
    for _ in range(MAX_STEPS):
        system = {"role": "system", "content": prompts.agent_prompt(s.channel, customer)}
        reply = await llm.chat([system, *history], tools=tools.TOOLS)
        if not reply.tool_calls:
            text = reply.text or "Bağışlayın, bir xəta oldu. Sualınızı bir daha yaza bilərsiniz?"
            history.append({"role": "assistant", "content": text})
            yield {"type": "text", "text": text}
            return
        history.append({"role": "assistant", "content": reply.text, "tool_calls": reply.tool_calls})
        for tc in reply.tool_calls:
            result = await asyncio.to_thread(tools.run, s, tc["name"], tc["args"])
            if tc["name"] == "find_customer" and result.get("found"):
                customer = db.one("SELECT * FROM customers WHERE id = %s", (s.customer_id,))
            history.append({"role": "tool", "tool_call_id": tc["id"], "name": tc["name"], "content": tools.result_text(result)})
            yield {"type": "tool", "name": tc["name"], "label": tools.STATUS_LABELS.get(tc["name"], tc["name"]),
                   "args": tc["args"], "result": result}
    text = "Bu məsələni əməkdaşımıza ötürürəm, tezliklə sizinlə əlaqə saxlanılacaq."
    history.append({"role": "assistant", "content": text})
    yield {"type": "text", "text": text}


def storable(history: list[dict]) -> list[dict]:
    """History for the DB: images replaced by a marker (they can be large)."""
    out = []
    for m in history:
        if m.get("images"):
            m = {**m, "images": [], "content": (m.get("content") or "") + f" [şəkil göndərildi x{len(m['images'])}]"}
        out.append(m)
    return out
