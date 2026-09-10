"""Async SQLAlchemy engine/session setup for the FastAPI app.

This is an async FastAPI app end-to-end (async route handlers, async
SQLAlchemy, asyncpg driver), so `AsyncSession` is used everywhere instead of
the classic sync `Session` — this avoids blocking the event loop on DB I/O,
which matters given the dataset scale (~4k patients + related rows) the API
has to page/query over efficiently.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

# Single engine for the process; created once at import time and reused for
# all connections (SQLAlchemy pools connections internally).
engine = create_async_engine(settings.database_url)
# expire_on_commit=False keeps ORM objects usable (e.g. for serialization)
# after a commit without triggering a lazy-load/refresh round-trip.
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    """FastAPI dependency that yields a request-scoped AsyncSession.

    The `async with` block ensures the session (and its connection) is
    closed at the end of the request regardless of success or error.
    """
    async with AsyncSessionLocal() as session:
        yield session
