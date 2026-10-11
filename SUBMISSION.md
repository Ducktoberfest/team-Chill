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
- **Fine-tuning:** we fine-tuned **Gemma 4 E2B** with Unsloth (QLoRA) on a labelled Azerbaijani support dataset, so the analysis can run on a local 8 GB GPU. Results are in `training/REPORT.md`.

## How we built it
Gemma 4 26B MoE (Gemini API), Gemma 4 E2B/E4B (Ollama, Unsloth), EmbeddingGemma + pgvector on Neon Postgres, FastAPI, ElevenLabs Conversational AI, Three.js, Openverse CC images.

## Technologies
Gemma 4, EmbeddingGemma, Unsloth, Ollama, Gemini API, Neon, pgvector, FastAPI, ElevenLabs, Three.js

## AI tools disclosure
We used Claude Code as an AI coding assistant during the build.
