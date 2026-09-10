"""End-to-end test of the Alembic migration against a real database.

Unlike the other tests, this does NOT use the `db_session` fixture's
metadata-driven create_all -- it actually shells out to run `alembic
upgrade head`, exercising the real migration path (alembic/versions/) the
same way a deploy would.

KNOWN ENVIRONMENT CAVEAT: this test invokes the `alembic` CLI via
`subprocess.run(["alembic", ...])`, relying on it being on the shell's
PATH. If run outside an activated virtualenv (e.g. `.venv` not sourced),
this fails with a "command not found"-style error that has nothing to do
with the migration itself -- it's a pre-existing, environment-only
failure mode, not a code defect. Run tests via `.venv/bin/python -m
pytest` or activate the venv first to avoid it; this is also why it's
excluded from the default verification run in some contexts.
"""

import os
import subprocess

from sqlalchemy import create_engine, inspect

TEST_SYNC_URL = "postgresql://postgres:postgres@localhost:5432/beauty_medspa_test"


def test_migration_creates_all_expected_tables():
    """Running `alembic upgrade head` against a clean DB creates exactly the expected tables.

    Confirms the migration in alembic/versions/0001_initial_schema.py
    actually applies cleanly and produces the full expected table set
    (plus Alembic's own bookkeeping table, alembic_version) -- catching
    drift between the migration and app/models.py that unit tests against
    an ORM-generated schema wouldn't catch.
    """
    env = os.environ.copy()
    env["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5432/beauty_medspa_test"
    subprocess.run(["alembic", "upgrade", "head"], env=env, check=True)

    engine = create_engine(TEST_SYNC_URL)
    tables = set(inspect(engine).get_table_names())

    assert tables == {
        "patients", "providers", "services",
        "appointments", "appointment_services", "payments",
        "alembic_version",
    }
