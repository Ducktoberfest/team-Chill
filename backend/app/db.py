"""Neon Postgres access (psycopg 3 connection pool, rows as dicts)."""
from __future__ import annotations

from typing import Any

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app import config

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        if not config.DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not set")
        _pool = ConnectionPool(config.DATABASE_URL, min_size=1, max_size=5, open=True,
                               kwargs={"row_factory": dict_row})
    return _pool


def query(sql: str, params: Any = None) -> list[dict]:
    with pool().connection() as conn:
        cur = conn.execute(sql, params)
        return cur.fetchall() if cur.description else []


def one(sql: str, params: Any = None) -> dict | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: Any = None) -> None:
    with pool().connection() as conn:
        conn.execute(sql, params)


__all__ = ["pool", "query", "one", "execute", "Jsonb"]
