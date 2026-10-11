"""Gemma 4 chat with tool calling and image input.

One message format (plain dicts) for the whole app, two interchangeable backends:
  - gemini: Gemma 4 served by the Gemini API (google-genai SDK)
  - ollama: Gemma 4 running locally through Ollama's OpenAI-compatible API

Message dicts:
  {"role": "system" | "user" | "assistant" | "tool",
   "content": str,
   "images": [{"mime": "image/png", "data": <base64 str>}],      # user only
   "tool_calls": [{"id": str, "name": str, "args": dict}],         # assistant only
   "tool_call_id": str, "name": str}                               # tool only
Tool specs: {"name": str, "description": str, "parameters": <JSON schema>}
"""
from __future__ import annotations

import base64
import json
import uuid
from dataclasses import dataclass, field

import httpx
from google import genai
from google.genai import types

from app import config


@dataclass
class Reply:
    text: str
    tool_calls: list[dict] = field(default_factory=list)


class LLMError(RuntimeError):
    pass


_gemini: genai.Client | None = None


def _gemini_client() -> genai.Client:
    global _gemini
    if _gemini is None:
        if not config.GEMINI_API_KEY:
            raise LLMError("GEMINI_API_KEY is not set")
        _gemini = genai.Client(api_key=config.GEMINI_API_KEY)
    return _gemini


async def chat(messages: list[dict], tools: list[dict] | None = None, json_schema: dict | None = None) -> Reply:
    """One model turn. Returns text and/or tool calls; the caller runs the tools and loops."""
    if config.LLM_BACKEND == "ollama":
        return await _chat_ollama(messages, tools, json_schema)
    return await _chat_gemini(messages, tools, json_schema)


# ---------------------------------------------------------------- Gemini API

def _to_gemini(messages: list[dict]) -> tuple[str | None, list[types.Content]]:
    system, contents = None, []
    for m in messages:
        role = m["role"]
        if role == "system":
            system = (system + "\n\n" if system else "") + m["content"]
        elif role == "user":
            parts = [types.Part.from_text(text=m["content"])] if m.get("content") else []
            for img in m.get("images", []):
                parts.append(types.Part.from_bytes(data=base64.b64decode(img["data"]), mime_type=img["mime"]))
            contents.append(types.Content(role="user", parts=parts))
        elif role == "assistant":
            parts = [types.Part.from_text(text=m["content"])] if m.get("content") else []
            parts += [types.Part.from_function_call(name=tc["name"], args=tc["args"]) for tc in m.get("tool_calls", [])]
            contents.append(types.Content(role="model", parts=parts))
        elif role == "tool":
            part = types.Part.from_function_response(name=m["name"], response={"result": m["content"]})
            # consecutive tool results go back in one user turn
            if contents and contents[-1].role == "user" and contents[-1].parts and contents[-1].parts[0].function_response:
                contents[-1].parts.append(part)
            else:
                contents.append(types.Content(role="user", parts=[part]))
    return system, contents


async def _chat_gemini(messages, tools, json_schema) -> Reply:
    system, contents = _to_gemini(messages)
    cfg = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.4,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    if tools:
        cfg.tools = [types.Tool(function_declarations=[
            types.FunctionDeclaration(name=t["name"], description=t["description"],
                                      parameters_json_schema=t["parameters"]) for t in tools])]
    if json_schema:
        cfg.response_mime_type = "application/json"
        cfg.response_json_schema = json_schema
    try:
        resp = await _gemini_client().aio.models.generate_content(model=config.GEMINI_MODEL, contents=contents, config=cfg)
    except Exception as e:  # noqa: BLE001 - surface any SDK/HTTP error uniformly
        raise LLMError(f"Gemini API: {e}") from e
    text, calls = [], []
    for cand in resp.candidates or []:
        for p in (cand.content.parts if cand.content else None) or []:
            if p.function_call:
                calls.append({"id": p.function_call.id or uuid.uuid4().hex[:12],
                              "name": p.function_call.name, "args": dict(p.function_call.args or {})})
            elif p.text and not p.thought:
                text.append(p.text)
        break
    return Reply("".join(text).strip(), calls)


# ---------------------------------------------------------------- Ollama (local)

def _to_openai(messages: list[dict]) -> list[dict]:
    out = []
    for m in messages:
        role = m["role"]
        if role == "user" and m.get("images"):
            content = [{"type": "text", "text": m.get("content") or ""}]
            content += [{"type": "image_url", "image_url": {"url": f"data:{i['mime']};base64,{i['data']}"}} for i in m["images"]]
            out.append({"role": "user", "content": content})
        elif role == "assistant" and m.get("tool_calls"):
            out.append({"role": "assistant", "content": m.get("content") or "", "tool_calls": [
                {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": json.dumps(tc["args"])}}
                for tc in m["tool_calls"]]})
        elif role == "tool":
            out.append({"role": "tool", "tool_call_id": m["tool_call_id"], "content": m["content"]})
        else:
            out.append({"role": role, "content": m.get("content") or ""})
    return out


async def _chat_ollama(messages, tools, json_schema) -> Reply:
    body: dict = {"model": config.OLLAMA_MODEL, "messages": _to_openai(messages), "temperature": 0.4}
    if tools:
        body["tools"] = [{"type": "function", "function": t} for t in tools]
    if json_schema:
        body["response_format"] = {"type": "json_schema", "json_schema": {"name": "out", "schema": json_schema}}
    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(f"{config.OLLAMA_URL}/v1/chat/completions", json=body)
    if r.status_code >= 400:
        raise LLMError(f"Ollama {r.status_code}: {r.text[:300]}")
    msg = r.json()["choices"][0]["message"]
    calls = []
    for tc in msg.get("tool_calls") or []:
        args = tc["function"].get("arguments") or "{}"
        calls.append({"id": tc.get("id") or uuid.uuid4().hex[:12], "name": tc["function"]["name"],
                      "args": json.loads(args) if isinstance(args, str) else args})
    return Reply((msg.get("content") or "").strip(), calls)


def backend_label() -> str:
    return f"{config.GEMINI_MODEL} (Gemini API)" if config.LLM_BACKEND != "ollama" else f"{config.OLLAMA_MODEL} (Ollama, local)"
