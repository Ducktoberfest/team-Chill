"""Settings from environment variables (backend/.env is loaded if present)."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


LLM_BACKEND = env("LLM_BACKEND", "gemini")  # gemini | ollama
GEMINI_API_KEY = env("GEMINI_API_KEY")
GEMINI_MODEL = env("GEMINI_MODEL", "gemma-4-31b-it")
OLLAMA_URL = env("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = env("OLLAMA_MODEL", "gemma4:e4b-it-qat")
EMBED_MODEL = env("EMBED_MODEL", "embeddinggemma")
EMBED_DIM = 768

DATABASE_URL = env("DATABASE_URL")
ELEVENLABS_AGENT_ID = env("ELEVENLABS_AGENT_ID")
CUSTOM_LLM_SECRET = env("CUSTOM_LLM_SECRET")

STORE_NAME = "Səbət"
AGENT_NAME = "Aysu"
