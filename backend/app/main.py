"""ChillDesk API: web chat, ElevenLabs Custom LLM endpoint (voice), automation and dashboard."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import agent, automation, config, db, llm
from app.tools import Session

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("chilldesk")
WEB = Path(__file__).resolve().parents[2] / "web"

# Full in-memory history per conversation (images included); the DB keeps a storable copy.
HISTORY: dict[str, list[dict]] = {}
SESSIONS: dict[str, Session] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(automation.sweeper())
    yield
    task.cancel()


app = FastAPI(title="ChillDesk", lifespan=lifespan)


def _session(conversation_id: str | None, channel: str, customer_id: str | None) -> tuple[Session, list[dict]]:
    cid = conversation_id or f"{channel[:1].upper()}-{uuid.uuid4().hex[:10]}"
    if cid not in SESSIONS:
        row = db.one("SELECT * FROM conversations WHERE id = %s", (cid,))
        if row:
            SESSIONS[cid] = Session(cid, row["channel"], row["customer_id"])
            HISTORY[cid] = list(row["messages"])
        else:
            db.execute("INSERT INTO conversations (id, channel, customer_id) VALUES (%s,%s,%s)", (cid, channel, customer_id))
            SESSIONS[cid] = Session(cid, channel, customer_id)
            HISTORY[cid] = []
    return SESSIONS[cid], HISTORY[cid]


def _save(s: Session) -> None:
    db.execute("UPDATE conversations SET messages = %s, customer_id = %s, updated_at = now() WHERE id = %s",
               (db.Jsonb(agent.storable(HISTORY[s.conversation_id])), s.customer_id, s.conversation_id))


# ------------------------------------------------------------------ web chat

class Image(BaseModel):
    mime: str
    data: str  # base64


class ChatIn(BaseModel):
    conversation_id: str | None = None
    customer_id: str | None = None
    message: str = ""
    images: list[Image] = []


@app.post("/api/chat")
async def chat(body: ChatIn):
    """Server-sent events: tool steps as they happen, then the answer."""
    s, history = await asyncio.to_thread(_session, body.conversation_id, "web", body.customer_id)
    user_msg = {"role": "user", "content": body.message or "(müştəri şəkil göndərdi)",
                "images": [i.model_dump() for i in body.images]}

    async def stream():
        yield f"data: {json.dumps({'type': 'conversation', 'id': s.conversation_id})}\n\n"
        try:
            async for ev in agent.respond(s, history, user_msg):
                yield f"data: {json.dumps(ev, ensure_ascii=False, default=str)}\n\n"
        except llm.LLMError as e:
            log.exception("llm error")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        finally:
            await asyncio.to_thread(_save, s)
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/api/conversations/{cid}/end")
async def end_conversation(cid: str):
    analysis = await automation.analyze(cid)
    SESSIONS.pop(cid, None)
    HISTORY.pop(cid, None)
    return {"conversation_id": cid, "analysis": analysis}


@app.post("/api/voice/start")
async def voice_start(body: dict):
    """Browser calls this before starting an ElevenLabs session; the id is passed back to us via customLlmExtraBody."""
    s, _ = await asyncio.to_thread(_session, None, "voice", body.get("customer_id"))
    return {"conversation_id": s.conversation_id}


# ------------------------------------------------------------------ ElevenLabs Custom LLM (OpenAI-compatible)

def _voice_key(body: dict) -> str:
    extra = body.get("elevenlabs_extra_body") or {}
    if extra.get("conversation_id"):
        return extra["conversation_id"]
    first_user = next((m.get("content") for m in body.get("messages", []) if m.get("role") == "user"), "")
    return "V-" + hashlib.sha1(json.dumps(first_user, default=str).encode()).hexdigest()[:10]


def _chunk(cid: str, text: str | None, finish: str | None = None) -> str:
    return "data: " + json.dumps({"id": cid, "object": "chat.completion.chunk", "created": int(time.time()),
                                  "model": "gemma-4", "choices": [{"index": 0, "delta": {"content": text} if text else {},
                                                                   "finish_reason": finish}]}, ensure_ascii=False) + "\n\n"


@app.post("/v1/chat/completions")
async def custom_llm(request: Request, authorization: str | None = Header(default=None)):
    if config.CUSTOM_LLM_SECRET and authorization != f"Bearer {config.CUSTOM_LLM_SECRET}":
        raise HTTPException(401, "bad token")
    body = await request.json()
    extra = body.get("elevenlabs_extra_body") or {}
    s, history = await asyncio.to_thread(_session, _voice_key(body), "voice", extra.get("customer_id"))
    last_user = next((m for m in reversed(body.get("messages", [])) if m.get("role") == "user"), None)
    text = last_user.get("content") if last_user else ""
    if isinstance(text, list):
        text = " ".join(p.get("text", "") for p in text if isinstance(p, dict))
    cid = "chatcmpl-" + uuid.uuid4().hex[:12]

    async def stream():
        filler_sent = False
        try:
            async for ev in agent.respond(s, history, {"role": "user", "content": text or "..."}):
                if ev["type"] == "tool" and not filler_sent:
                    filler_sent = True
                    yield _chunk(cid, "Bir saniyə, yoxlayıram. ")
                elif ev["type"] == "text":
                    yield _chunk(cid, ev["text"])
        except llm.LLMError:
            log.exception("llm error (voice)")
            yield _chunk(cid, "Bağışlayın, texniki problem yarandı. Bir az sonra yenidən cəhd edin.")
        finally:
            await asyncio.to_thread(_save, s)
        yield _chunk(cid, None, "stop")
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


# ------------------------------------------------------------------ dashboard + config

@app.get("/api/config")
def get_config():
    customers = db.query("SELECT id, name, city FROM customers ORDER BY id")
    return {"agent_id": config.ELEVENLABS_AGENT_ID, "model": llm.backend_label(), "embed_model": config.EMBED_MODEL,
            "store": config.STORE_NAME, "agent": config.AGENT_NAME, "customers": customers}


@app.get("/api/products")
def get_products():
    return db.query("SELECT id, name, category, price::float AS price, stock FROM products ORDER BY category, price")


@app.get("/api/dashboard")
def dashboard():
    convs = db.query("SELECT c.id, c.channel, c.started_at, c.updated_at, c.analysis, cu.name AS customer, "
                     "jsonb_array_length(c.messages) AS n_messages FROM conversations c "
                     "LEFT JOIN customers cu ON cu.id = c.customer_id "
                     "WHERE jsonb_array_length(c.messages) > 0 ORDER BY c.updated_at DESC LIMIT 50")
    tickets = db.query("SELECT t.*, cu.name AS customer FROM tickets t LEFT JOIN customers cu ON cu.id = t.customer_id "
                       "ORDER BY t.created_at DESC LIMIT 50")
    returns = db.query("SELECT r.*, p.name AS product FROM returns r JOIN products p ON p.id = r.product_id "
                       "ORDER BY r.created_at DESC LIMIT 50")
    analyzed = [c["analysis"] for c in convs if c["analysis"]]
    kpis = {
        "conversations": len(convs),
        "analyzed": len(analyzed),
        "auto_resolved": sum(1 for a in analyzed if a.get("resolved")),
        "negative": sum(1 for a in analyzed if a.get("sentiment") == "negative"),
        "open_tickets": sum(1 for t in tickets if t["status"] == "open"),
        "returns": len(returns),
    }
    return {"kpis": kpis, "conversations": convs, "tickets": tickets, "returns": returns,
            "kb_gaps": [a["kb_gap"] for a in analyzed if a.get("kb_gap")]}


@app.get("/api/conversations/{cid}")
def get_conversation(cid: str):
    row = db.one("SELECT * FROM conversations WHERE id = %s", (cid,))
    if not row:
        raise HTTPException(404)
    return row


@app.get("/")
def index():
    return FileResponse(WEB / "index.html")


@app.get("/dashboard")
def dashboard_page():
    return FileResponse(WEB / "dashboard.html")


app.mount("/static", StaticFiles(directory=WEB), name="static")
