# ChillDesk — an open-weight AI support agent for online stores

> Built by **team-Chill** at **Ducktoberfest Baku 2026** (Hacktoberfest Hack Day, 11 Oct 2026).
> Prize categories: **Best Use of Gemma 4** · **Best Open-Source AI Project**

ChillDesk gives an online store a support agent that **talks to customers by chat and by phone-quality voice, looks at photos, takes real actions in the store's database, and then closes the loop automatically**: every finished conversation is summarized, classified and turned into tickets and a follow-up email, with no human in the loop.

The demo store is **Səbət**, a fictional Azerbaijani online shop. All customers, orders and products are synthetic. The agent is **Aysu** and speaks Azerbaijani, Russian and English.

## What it does

| | |
|---|---|
| 💬 **Chat agent** | Gemma 4 with native function calling: finds the customer, reads orders and tracking, searches the store policy, opens returns and tickets. Every tool call is shown in the chat, so you can see what the AI did. |
| 📷 **Multimodal support** | The customer attaches a photo (a damaged product, an error screenshot, a receipt). Gemma 4 describes what it sees, decides, and stores its photo assessment with the return request. |
| 📞 **Voice agent** | ElevenLabs Conversational AI handles speech-to-text and the voice. The **brain is still Gemma 4**: ElevenLabs calls our OpenAI-compatible `/v1/chat/completions` "Custom LLM" endpoint, which runs the same tool-calling agent. |
| ⚡ **Post-conversation automation** | When a chat ends, or goes idle for 90 s (voice calls), Gemma 4 produces structured JSON: summary, category, urgency, sentiment, resolved/needs-human, action items, a follow-up email, and a knowledge-base gap. If a human is needed, it opens a ticket for the right team automatically. |
| 📊 **Ops dashboard** | `/dashboard` shows KPIs, every conversation with its AI analysis and follow-up email, tickets (agent- vs automation-created), returns with photo assessments, and questions the KB couldn't answer. |
| 🔎 **RAG on open weights** | The store's policies are embedded with **EmbeddingGemma** (running locally in Ollama) and searched with **pgvector** in **Neon** Postgres. |

## Architecture

```
 Browser (Səbət store + Aysu widget)          Ops dashboard
   │  chat (SSE) + photos      │ voice (WebRTC)        │
   ▼                           ▼                       │
 FastAPI ◄──── ElevenLabs Agent ── "Custom LLM" ──┐    │
   │  /api/chat                /v1/chat/completions│    │
   ▼                                              ▼    ▼
 Agent loop (app/agent.py) ── Gemma 4 (Gemini API, or local Ollama)
   │ tools: find_customer · list_orders · get_order · search_knowledge
   │        search_products · create_return · create_ticket
   ▼
 Neon Postgres + pgvector  ◄── EmbeddingGemma (Ollama) for KB search
   ▲
 Automation (app/automation.py): Gemma 4 → JSON analysis → tickets, follow-up email
```

## Models and key dependencies

| Component | Model / library | License |
|---|---|---|
| Agent + vision + automation | **Gemma 4** `gemma-4-31b-it` via the Gemini API, or `gemma4:e4b-it-qat` locally via Ollama | [Apache 2.0](https://opensource.googleblog.com/2026/03/gemma-4-expanding-the-gemmaverse-with-apache-20.html) |
| Embeddings | **EmbeddingGemma** (`embeddinggemma` in Ollama, 768-dim) | [Gemma Terms of Use](https://ai.google.dev/gemma/terms) |
| Voice I/O | ElevenLabs Conversational AI (STT + TTS only; reasoning is done by Gemma) | proprietary service |
| Database | Neon Postgres + pgvector | — |
| Backend | FastAPI, google-genai, psycopg 3, httpx | MIT / Apache 2.0 / LGPL |
| Frontend | Plain HTML/CSS/JS, `@elevenlabs/client` | MIT |

We picked the local model with [llmfit](https://github.com/AlexsJones/llmfit) for our hardware (RTX 4070 Laptop, 8 GB). Gemma 4 E4B QAT was the best official Gemma 4 build that fits fully on the GPU.

## Run it

Requirements: Python 3.11+, [uv](https://docs.astral.sh/uv/), [Ollama](https://ollama.com), and a [Neon](https://neon.tech) database.

```bash
ollama pull embeddinggemma
ollama pull gemma4:e4b-it-qat        # optional: fully local mode

cd backend
uv venv && uv pip install -r requirements.txt
cp .env.example .env                 # fill GEMINI_API_KEY, DATABASE_URL (Neon), ELEVENLABS_AGENT_ID
.venv/bin/python -m seed.load        # creates the schema, loads demo data, embeds the KB
.venv/bin/uvicorn app.main:app --port 8000
```

Open <http://localhost:8000> (store and agent) and <http://localhost:8000/dashboard> (ops view).

**Fully local / offline brain:** set `LLM_BACKEND=ollama` in `.env`. The same agent then runs on Gemma 4 on your own GPU.

**Voice:** create an ElevenLabs Conversational AI agent. Under *LLM*, choose **Custom LLM** with the server URL `https://<public-url>/v1` (for local testing, use `cloudflared tunnel --url http://localhost:8000`), and put its id in `ELEVENLABS_AGENT_ID`. The system prompt lives in `backend/app/prompts.py`; ours replaces the one set in ElevenLabs.

## Demo script (2 minutes)

1. Log in as **Leyla Məmmədova** → "Qulaqlığım zədəli gəlib" + attach a photo of a cracked headphone. Aysu reads the photo, finds order SB-1042 and opens a free replacement. The tool calls are visible in the chat.
2. Switch to **Rəşad Əliyev** → ask about his late fridge (SB-1051). Aysu checks the tracking and the delay policy (10% code), then opens a delivery ticket.
3. Press 📞 and ask by voice "Sifarişim nə vaxt gələcək?". The same agent answers, now with voice.
4. Press ✓ (end) → open **/dashboard**: summary, urgency, sentiment, auto ticket and a ready follow-up email, all generated by Gemma 4.

## Built during the event

All code in this repository was written on 11 Oct 2026 during Ducktoberfest Baku. The git history shows the timeline. In line with MLH rules on AI tools: we used **Claude Code** as an AI coding assistant during the build.

## License

[MIT](LICENSE) © 2026 team-Chill
