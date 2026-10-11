"""Knowledge-base search: EmbeddingGemma (local, via Ollama) + pgvector cosine search in Neon."""
from __future__ import annotations

import httpx

from app import config, db

# EmbeddingGemma was trained with task prompts; using them improves retrieval quality.
QUERY_PREFIX = "task: search result | query: "
DOC_PREFIX = "title: {title} | text: "


def embed(texts: list[str]) -> list[str]:
    """Embeddings as pgvector text literals ('[0.1,0.2,...]'), ready to cast with ::vector."""
    r = httpx.post(f"{config.OLLAMA_URL}/api/embed", json={"model": config.EMBED_MODEL, "input": texts}, timeout=120)
    r.raise_for_status()
    return ["[" + ",".join(f"{x:.6f}" for x in v) + "]" for v in r.json()["embeddings"]]


def search(query: str, k: int = 4) -> list[dict]:
    q = embed([QUERY_PREFIX + query])[0]
    rows = db.query(
        "SELECT doc, title, content, 1 - (embedding <=> %s::vector) AS score FROM kb_chunks "
        "ORDER BY embedding <=> %s::vector LIMIT %s",
        (q, q, k))
    return [{"doc": r["doc"], "title": r["title"], "content": r["content"], "score": round(float(r["score"]), 3)} for r in rows]
