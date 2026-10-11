# team-Chill — Ducktoberfest Baku 2026 (Hacktoberfest Hack Day)

Team project for Hacktoberfest Hack Day Baku (Orduck community + MLH), 11 Oct 2026, Peerstack Academy.
Repo: https://github.com/Ducktoberfest/team-Chill (public, was empty at start). Team of 3.

## Timeline (Baku, +04)
- 13:00 coffee break · 13:30 second session · **15:30 evaluation/demos** · 17:00 awards
- MLH submission hard deadline: **18:00**, but demos start 15:30, so the build must be ready by about 15:00
- Submit at https://www.mlh.com/events/ducktoberfest ("Submit a Project"). One submission can enter every prize category it qualifies for, so select BOTH.

## Prize categories (enter both)
1. **Best Use of Gemma 4** (Google DeepMind): Gemma 4 is an open-weights multimodal model (text + images), available through the Gemini API. Themes: multimodal assistant, a focused AI tool (learning, creativity, productivity, community), rapid prototyping with the Gemini API.
2. **Best Open-Source AI Project** (DigitalOcean; prize is a DEV badge and an MLH+DEV swag bag). Requirements:
   - Open-source or open-weight AI must be an important, demoable part of how the project works.
   - Public GitHub repo with an **open-source LICENSE** (no license means not eligible).
   - README: what you built, how to run or try it, which model (with a link to its license or terms) and the key dependencies.
   - If it is an agent skill, it must follow the Agent Skills open standard (SKILL.md).
   - If it is a model harness, it needs an original implementation or meaningful changes.
   - Judging: meets requirements, solves a clear problem, substantial team work, working demo, clear explanation, verifiable source/license/model. PR counts don't matter.
   - Event theme: an AI agent or automation workflow built on open models.

## Resources and offers
- DigitalOcean $25 credit: hacktoberfest.com/my/promos. Valid 3 days after activation, expires 31 Oct 2026, and can't be used for proprietary models. Optional: use it to host a live demo URL on App Platform.
- Gemma links: mlh.link/gemma, mlh.link/gemma-quickstart, mlh.link/gemma-docs, mlh.link/gemma-beginnerguide, mlh.link/hackdays-gemma-demo
- DigitalOcean: mlh.link/digitalocean-starterkit-h26, mlh.link/digitalocean-libraries-h26, mlh.link/digitalocean-hermes-h26 (one-click Hermes deploy)
- DEV write-up for extra promo credits and prizes: mlh.link/dev-hacktoberfest
- devrelay.com MCP server (MLH+DEV) is installed and can submit the project and look up offers and sponsor skills.

## Decisions (11:55)
- WRITE FROM SCRATCH TODAY. MLH Standard Rules 6/9/10: all work must happen during the hackathon, and code from earlier projects may not be re-used. Prior code is NOT imported. Ideas and architecture may be re-used, code may not. A brand-new product with its own name.
- Customer-support agent for ONE new fictional business.
- Main LLM: Gemma 4 via the Gemini API (gemma-4-31b-it / gemma-4-26b-a4b-it, native function calling, google-genai SDK), with a local Ollama fallback documented.
- DB: Neon Postgres (+pgvector, EmbeddingGemma for RAG).
- Voice: ElevenLabs Conversational AI agent, same voice, new system prompt, "Custom LLM" pointing at our backend's OpenAI-compatible /v1/chat/completions endpoint.
- Value-add: (a) multimodal: customer sends a screenshot/photo and Gemma 4 reads it; (b) post-conversation automation: Gemma summarizes, classifies category/urgency/sentiment, opens a ticket, drafts a follow-up email, saves to Neon and shows it on the dashboard.
- Fresh UI style. LICENSE: MIT or Apache-2.0.

## Status
- [x] Read the event, track and promo pages (11:20)
- [x] Idea chosen (11:50); decided to build from scratch (11:55)
- [ ] Gemma 4 tool-calling smoke test → LLM swap → new business domain → Neon → automation + multimodal → restyle → README/LICENSE → push → MLH submission (both categories)

## User preferences
- Ali writes in Azerbaijani, so reply in Azerbaijani.
