"""Postgres access (local, Neon, Supabase, or Cloud SQL) through a small psycopg connection pool."""

from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from settings import DATABASE_URL

_pool: ConnectionPool | None = None


def init_db() -> None:
    """Open the pool and apply schema.sql. A no-op when DATABASE_URL is unset."""
    global _pool
    if not DATABASE_URL or _pool is not None:
        return
    _pool = ConnectionPool(
        DATABASE_URL,
        min_size=1,
        max_size=10,
        # prepare_threshold=None: no server-side prepared statements, which the connection
        # poolers in front of hosted Postgres (Neon, Supabase) do not support.
        kwargs={"row_factory": dict_row, "connect_timeout": 10, "prepare_threshold": None},
        open=True,
    )
    schema = (Path(__file__).resolve().parent / "schema.sql").read_text()
    with _pool.connection() as conn:
        conn.execute(schema)


def close_db() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def db_status() -> str:
    if not DATABASE_URL:
        return "unconfigured"
    if _pool is None:
        return "error"
    try:
        with _pool.connection() as conn:
            conn.execute("SELECT 1")
        return "ok"
    except Exception:
        return "error"


@contextmanager
def connection():
    """A pooled connection wrapped in a transaction (committed on success)."""
    if _pool is None:
        raise HTTPException(503, "The database is not configured. Set DATABASE_URL on the server.")
    with _pool.connection() as conn:
        yield conn
