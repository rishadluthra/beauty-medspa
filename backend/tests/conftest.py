"""Shared pytest fixtures for the backend test suite.

Defines `db_session`, the fixture nearly every test in this suite depends
on (directly or via tests/factories.py) to get a clean database to work
against.
"""

import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Base

# Deliberately a REAL Postgres database, not SQLite or a mock/in-memory
# engine. Some queries (e.g. the demographics repository's use of
# `func.age()` / `extract()` for age-bucketing) rely on Postgres-specific
# SQL functions that a different-dialect DB either doesn't support or
# would silently behave differently for -- so testing against anything
# else would give false confidence. This assumes a local Postgres with a
# `beauty_medspa_test` database already created.
TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/beauty_medspa_test"


@pytest_asyncio.fixture
async def db_session():
    """Yield an AsyncSession backed by a freshly-reset schema.

    Every test gets a fully clean slate: all tables are dropped and
    recreated from the current SQLAlchemy models before the session is
    handed out, so tests never see leftover rows from a previous test or
    a stale schema from a previous migration state. This costs a bit of
    per-test setup time in exchange for full test isolation and no
    dependence on running `alembic upgrade` separately before the suite.
    """
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()
