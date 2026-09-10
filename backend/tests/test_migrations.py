import os
import subprocess

from sqlalchemy import create_engine, inspect

TEST_SYNC_URL = "postgresql://postgres:postgres@localhost:5432/beauty_medspa_test"


def test_migration_creates_all_expected_tables():
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
