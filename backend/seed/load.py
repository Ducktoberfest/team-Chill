"""Create the schema in Neon and (re)load demo data + the knowledge base embeddings.

    cd backend && .venv/bin/python -m seed.load          # reset demo data, keep nothing
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from app import db, rag
from app.config import ROOT
from seed.data import CUSTOMERS, ORDERS, PRODUCTS

KB_DIR = Path(__file__).parent / "kb"


def kb_chunks() -> list[tuple[str, str, str]]:
    """Split each markdown doc on '## ' headings -> (doc, title, content)."""
    out = []
    for f in sorted(KB_DIR.glob("*.md")):
        doc_title = f.read_text(encoding="utf-8").splitlines()[0].lstrip("# ").strip()
        for sec in re.split(r"^## ", f.read_text(encoding="utf-8"), flags=re.M)[1:]:
            head, _, body = sec.partition("\n")
            out.append((f.stem, f"{doc_title} — {head.strip()}", body.strip()))
    return out


def main() -> None:
    db.execute((ROOT / "schema.sql").read_text())
    db.execute("TRUNCATE tickets, returns, conversations, order_items, orders, products, customers, kb_chunks RESTART IDENTITY CASCADE")
    with db.pool().connection() as conn:
        conn.cursor().executemany("INSERT INTO customers VALUES (%s,%s,%s,%s,%s)", CUSTOMERS)
        conn.cursor().executemany("INSERT INTO products VALUES (%s,%s,%s,%s,%s,%s)", PRODUCTS)
        price = {p[0]: p[3] for p in PRODUCTS}
        for (oid, cust, status, pay, courier, track, addr, created, eta, delivered, items, timeline) in ORDERS:
            total = sum(price[pid] * q for pid, q in items)
            tl = [{"event": e, "at": t.isoformat(timespec="minutes")} for e, t in timeline]
            conn.execute("INSERT INTO orders VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                         (oid, cust, status, total, pay, courier, track, addr, created, eta, delivered, json.dumps(tl, ensure_ascii=False)))
            for pid, q in items:
                conn.execute("INSERT INTO order_items VALUES (%s,%s,%s,%s)", (oid, pid, q, price[pid]))
    chunks = kb_chunks()
    vecs = rag.embed([rag.DOC_PREFIX.format(title=t) + c for _, t, c in chunks])
    with db.pool().connection() as conn:
        for (doc, title, content), v in zip(chunks, vecs):
            conn.execute("INSERT INTO kb_chunks (doc, title, content, embedding) VALUES (%s,%s,%s,%s::vector)", (doc, title, content, v))
    print(f"loaded {len(CUSTOMERS)} customers, {len(PRODUCTS)} products, {len(ORDERS)} orders, {len(chunks)} KB chunks")
    for q in ["pul nə vaxt karta qayıdır?", "sifarişim gecikir", "qulaqlıq sınıq gəldi"]:
        print(q, "->", [r["title"] for r in rag.search(q, 2)])
    db.pool().close()


if __name__ == "__main__":
    main()
