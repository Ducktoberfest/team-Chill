# ChillDesk: MLH submission draft

**Project name:** ChillDesk: an open-weight AI support agent (Gemma 4) for online stores

**Tagline:** Aysu answers customers by chat, photo and voice, takes real actions in the store database, and closes every conversation with an automatic summary, ticket and follow-up email. Gemma 4 does the work end to end.

**Repository:** https://github.com/Ducktoberfest/team-Chill (MIT)

**Prize categories:** Best Use of Gemma 4 · Best Open-Source AI Project

## What it does
- **Agent:** Gemma 4 with native function calling runs the support agent. It looks up the customer and their orders, reads tracking, searches the store policy (RAG), opens returns and opens tickets.
- **Photos:** Gemma 4 reads customer photos, such as a damaged product, and puts its assessment into the return request.
- **Voice:** a phone-style call with a 3D avatar. ElevenLabs handles speech-to-text and the voice; Gemma 4 is the brain, reached through our OpenAI-compatible Custom LLM endpoint.
- **After the conversation:** Gemma 4 produces structured JSON with the summary, category, urgency, sentiment, resolved/needs-human flag, action items, follow-up email and knowledge-base gap. If a human is needed, a ticket opens automatically. All of it shows on the ops dashboard.
- **Fine-tuning:** we fine-tuned **Gemma 3 1B** with Unsloth QLoRA on 229 labelled Azerbaijani support conversations, in 284 s on an 8 GB laptop GPU. On a held-out test set, mean accuracy rose from 29.6% to 61.3% and valid JSON from 75% to 100%. On sentiment it beats zero-shot Gemma 4 26B (72.5% vs 70%). See `training/REPORT.md`.

## How we built it
Gemma 4 26B MoE (Gemini API), Gemma 4 E4B (Ollama, local fallback), Gemma 3 1B + LoRA (Unsloth), EmbeddingGemma + pgvector on Neon Postgres, FastAPI, ElevenLabs Conversational AI, Three.js, Openverse CC images.

## Technologies
Gemma 4, EmbeddingGemma, Unsloth, Ollama, Gemini API, Neon, pgvector, FastAPI, ElevenLabs, Three.js

## AI tools disclosure
We used Claude Code as an AI coding assistant during the build.
