"""Alembic migration runtime configuration.

This is Alembic's usual `env.py` entry point, adapted for an async backend.
The app talks to Postgres exclusively through async SQLAlchemy (`asyncpg` +
`AsyncSession`), so there is no synchronous engine/connection lying around
for Alembic's default (sync) template to reuse. Instead we build an async
engine ourselves and, for "online" migrations, drive it via
`connection.run_sync(...)` to bridge into Alembic's synchronous
migration-running API. This file is invoked by the `alembic` CLI (via
`alembic.ini`), not imported directly by the app.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.models import Base  # noqa: F401  (imports all model modules, registering them on Base.metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The metadata Alembic diffs against when autogenerating migrations, and
# validates against when running `alembic check`. Populated as a side
# effect of importing app.models above (each model module registers its
# table on Base.metadata when imported).
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit migration SQL to stdout/a script without a live DB connection.

    Used for `alembic upgrade --sql` style workflows (e.g. generating a
    script to hand to a DBA) rather than applying migrations directly.
    """
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """Synchronous callback that actually runs the migrations.

    Called via `AsyncConnection.run_sync`, which hands us a sync-style
    `Connection` proxy so Alembic's (sync) migration engine can operate on
    it despite the underlying engine being async.
    """
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Apply migrations against a live database using the async engine.

    NullPool is used because this is a short-lived, single-use connection
    for running migrations -- no benefit to pooling here, and pooling can
    interfere with cleanly disposing the engine afterward.
    """
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.database_url
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


# Alembic calls this module in one of two modes depending on how it was
# invoked; `asyncio.run` is needed here (vs. the sync template's direct
# call) because `run_migrations_online` is itself async.
if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
