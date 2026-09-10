# Beauty Med Spa Patient Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a read-only patient dashboard (Patient Table + Analytics Dashboard) backed by a PostgreSQL database loaded from the existing `seed_data/` JSON fixtures, with a FastAPI backend and Next.js 14 frontend, structured so a future AI query service can reuse the backend's query layer.

**Architecture:** Monorepo with `backend/` (FastAPI + async SQLAlchemy + Alembic, a thin router layer over a typed repository/query layer) and `frontend/` (Next.js 14 App Router + TypeScript + Tailwind + TanStack Query + Recharts). Postgres is the sole runtime data source — `seed_data/*.json` is migrated into it once and never read at runtime again.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0 (async, asyncpg driver), Alembic, pytest/pytest-asyncio; Next.js 14, React, TypeScript, Tailwind CSS, TanStack Query, Recharts; PostgreSQL 16; Railway (backend + DB) + Vercel (frontend).

**Spec:** `docs/superpowers/specs/2026-09-09-patient-dashboard-design.md`

## Global Constraints

- Backend: Python 3.10+, async Python, async SQLAlchemy (per `docs/SPEC.md`).
- Frontend: Next.js 14, React, TypeScript (per `docs/SPEC.md`).
- Database: PostgreSQL (per `docs/SPEC.md`).
- Money is always integer cents end-to-end — API responses, TS types, display formatting only converts to dollars at render time. Never floats in transit.
- Read-only: no create/update/delete endpoints or UI of any kind.
- No auth/access gating on the deployed app (synthetic seed data only).
- Monorepo: `backend/` and `frontend/` as top-level directories; `seed_data/` and `models.py` remain untouched at repo root.
- Deployment target: Railway (FastAPI backend + managed Postgres) + Vercel (Next.js frontend).
- AI-readiness for this phase means the repository/query layer only — no NL-to-SQL or agent service is built now.

**Note on styling:** the design doc mentions Tailwind + shadcn/ui. This plan hand-writes plain Tailwind components instead of running the `shadcn` CLI, so every file's exact contents can be specified deterministically here (the CLI's generated output isn't pinnable in a written plan). Visual outcome (clean, professional, whitespace-heavy) is unaffected; shadcn/ui can be layered in later as a README-noted enhancement.

---

## Task 1: Backend scaffolding, config, and DB connection

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/db.py`
- Create: `backend/app/main.py`
- Create: `backend/docker-compose.yml`
- Create: `backend/docker/init-test-db.sql`
- Create: `backend/.env.example`
- Test: `backend/tests/__init__.py`, `backend/tests/test_health.py`

**Interfaces:**
- Produces: `app.config.settings` (has `.database_url: str`, `.cors_origins: str`), `app.db.engine`, `app.db.AsyncSessionLocal`, `app.db.get_db()` (async generator dependency yielding an `AsyncSession`), FastAPI `app` instance in `app.main` with `GET /api/health`.

- [ ] **Step 1: Write `backend/pyproject.toml`**

```toml
[project]
name = "beauty-medspa-backend"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.110",
    "uvicorn[standard]>=0.27",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg>=0.29",
    "alembic>=1.13",
    "pydantic>=2.6",
    "pydantic-settings>=2.2",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",
]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
include = ["app*"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["."]
```

- [ ] **Step 2: Write `backend/app/__init__.py`** (empty file)

- [ ] **Step 3: Write `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/beauty_medspa"
    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
```

- [ ] **Step 4: Write `backend/app/db.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.database_url)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 5: Write `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(title="Beauty Med Spa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 6: Write `backend/docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: beauty_medspa
    ports:
      - "5432:5432"
    volumes:
      - ./docker/init-test-db.sql:/docker-entrypoint-initdb.d/init-test-db.sql
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 7: Write `backend/docker/init-test-db.sql`**

```sql
CREATE DATABASE beauty_medspa_test;
```

- [ ] **Step 8: Write `backend/.env.example`**

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/beauty_medspa
CORS_ORIGINS=http://localhost:3000
```

- [ ] **Step 9: Write `backend/tests/__init__.py`** (empty file)

- [ ] **Step 10: Write the failing test — `backend/tests/test_health.py`**

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_check_returns_ok():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 11: Install deps and run the test to verify it fails**

Run (from `backend/`):
```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest tests/test_health.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app'` (before install) or import error, since dependencies/module weren't installed yet. After `pip install -e ".[dev]"` completes, rerun — it should now PASS since `app/main.py` already exists from Step 5. (This task's TDD cycle is scaffolding-first since there's no pre-existing behavior to fail against; the meaningful check is that the app boots and dependencies resolve.)

- [ ] **Step 12: Run test to verify it passes**

Run: `pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 13: Start local Postgres and verify docker-compose works**

Run: `docker compose up -d`
Expected: container starts; `docker compose exec postgres psql -U postgres -l` lists both `beauty_medspa` and `beauty_medspa_test` databases.

- [ ] **Step 14: Commit**

```bash
git add backend/pyproject.toml backend/app backend/docker-compose.yml backend/docker backend/.env.example backend/tests
git commit -m "feat(backend): scaffold FastAPI app with config, DB connection, and health check"
```

---

## Task 2: SQLAlchemy models and initial Alembic migration

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/patient.py`
- Create: `backend/app/models/provider.py`
- Create: `backend/app/models/service.py`
- Create: `backend/app/models/appointment.py`
- Create: `backend/app/models/appointment_service.py`
- Create: `backend/app/models/payment.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/0001_initial_schema.py`
- Modify: `backend/pyproject.toml` (add `psycopg2-binary` to dev deps, needed only for the sync schema-inspection in this task's test)
- Test: `backend/tests/test_migrations.py`

**Interfaces:**
- Consumes: nothing from Task 1 beyond `app.config.settings`.
- Produces: `app.models.Base` (declarative base with all six tables registered on `Base.metadata` once `app.models` is imported), ORM classes `Patient`, `Provider`, `Service`, `Appointment`, `AppointmentService`, `Payment`.

- [ ] **Step 1: Write `backend/app/models/base.py`**

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 2: Write `backend/app/models/patient.py`**

```python
from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    date_of_birth: Mapped[datetime] = mapped_column(nullable=False)
    gender: Mapped[str] = mapped_column(String, nullable=False)
    address: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_date: Mapped[datetime] = mapped_column(nullable=False, index=True)
```

- [ ] **Step 3: Write `backend/app/models/provider.py`**

```python
from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    created_date: Mapped[datetime] = mapped_column(nullable=False)
```

- [ ] **Step 4: Write `backend/app/models/service.py`**

```python
from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Service(Base):
    __tablename__ = "services"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[int] = mapped_column(nullable=False)
    duration: Mapped[int] = mapped_column(nullable=False)
    created_date: Mapped[datetime] = mapped_column(nullable=False)
```

- [ ] **Step 5: Write `backend/app/models/appointment.py`**

```python
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_date: Mapped[datetime] = mapped_column(nullable=False)
```

- [ ] **Step 6: Write `backend/app/models/appointment_service.py`**

```python
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AppointmentService(Base):
    __tablename__ = "appointment_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    appointment_id: Mapped[str] = mapped_column(ForeignKey("appointments.id"), nullable=False, index=True)
    service_id: Mapped[str] = mapped_column(ForeignKey("services.id"), nullable=False, index=True)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    start: Mapped[datetime] = mapped_column(nullable=False, index=True)
    end: Mapped[datetime] = mapped_column(nullable=False)
```

- [ ] **Step 7: Write `backend/app/models/payment.py`**

```python
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(nullable=False)
    date: Mapped[datetime] = mapped_column(nullable=False, index=True)
    method: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id"), nullable=False)
    appointment_id: Mapped[str] = mapped_column(ForeignKey("appointments.id"), nullable=False, index=True)
    service_id: Mapped[str] = mapped_column(ForeignKey("services.id"), nullable=False)
    created_date: Mapped[datetime] = mapped_column(nullable=False)
```

- [ ] **Step 8: Write `backend/app/models/__init__.py`**

```python
from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.base import Base
from app.models.patient import Patient
from app.models.payment import Payment
from app.models.provider import Provider
from app.models.service import Service

__all__ = [
    "Base",
    "Patient",
    "Provider",
    "Service",
    "Appointment",
    "AppointmentService",
    "Payment",
]
```

- [ ] **Step 9: Add `psycopg2-binary` to `backend/pyproject.toml` dev deps**

```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",
    "psycopg2-binary>=2.9",
]
```

- [ ] **Step 10: Initialize Alembic**

Run (from `backend/`): `alembic init alembic`
This generates `backend/alembic.ini` and `backend/alembic/` with `env.py`, `script.py.mako`, and an empty `versions/`. Overwrite `env.py` in the next step.

- [ ] **Step 11: Write `backend/alembic/env.py`**

```python
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

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
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


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 12: Write `backend/alembic/versions/0001_initial_schema.py`**

```python
"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "patients",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("date_of_birth", sa.DateTime(), nullable=False),
        sa.Column("gender", sa.String(), nullable=False),
        sa.Column("address", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_patients_source", "patients", ["source"])
    op.create_index("ix_patients_created_date", "patients", ["created_date"])

    op.create_table(
        "providers",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "services",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("duration", sa.Integer(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "appointments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("patient_id", sa.String(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_appointments_patient_id", "appointments", ["patient_id"])
    op.create_index("ix_appointments_status", "appointments", ["status"])

    op.create_table(
        "appointment_services",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("appointment_id", sa.String(), sa.ForeignKey("appointments.id"), nullable=False),
        sa.Column("service_id", sa.String(), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("provider_id", sa.String(), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("start", sa.DateTime(), nullable=False),
        sa.Column("end", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_appointment_services_appointment_id", "appointment_services", ["appointment_id"])
    op.create_index("ix_appointment_services_service_id", "appointment_services", ["service_id"])
    op.create_index("ix_appointment_services_provider_id", "appointment_services", ["provider_id"])
    op.create_index("ix_appointment_services_start", "appointment_services", ["start"])

    op.create_table(
        "payments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("patient_id", sa.String(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("date", sa.DateTime(), nullable=False),
        sa.Column("method", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("provider_id", sa.String(), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("appointment_id", sa.String(), sa.ForeignKey("appointments.id"), nullable=False),
        sa.Column("service_id", sa.String(), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_payments_patient_id", "payments", ["patient_id"])
    op.create_index("ix_payments_appointment_id", "payments", ["appointment_id"])
    op.create_index("ix_payments_date", "payments", ["date"])
    op.create_index("ix_payments_status", "payments", ["status"])


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("appointment_services")
    op.drop_table("appointments")
    op.drop_table("services")
    op.drop_table("providers")
    op.drop_table("patients")
```

- [ ] **Step 13: Write the failing test — `backend/tests/test_migrations.py`**

```python
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
```

- [ ] **Step 14: Run test to verify it fails, then install deps and rerun**

Run (from `backend/`, with `docker compose up -d` already running from Task 1):
```bash
pytest tests/test_migrations.py -v
```
Expected first run: FAIL (`ModuleNotFoundError: alembic` or missing `psycopg2`) since the new dev dep isn't installed yet.
```bash
pip install -e ".[dev]"
pytest tests/test_migrations.py -v
```
Expected: PASS

- [ ] **Step 15: Commit**

```bash
git add backend/app/models backend/alembic backend/alembic.ini backend/pyproject.toml backend/tests/test_migrations.py
git commit -m "feat(backend): add SQLAlchemy models and initial Alembic migration"
```

---

## Task 3: Seed data loader

**Files:**
- Create: `backend/app/seed/__init__.py`
- Create: `backend/app/seed/load_seed_data.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_load_seed_data.py`

**Interfaces:**
- Consumes: `app.models.{Patient,Provider,Service,Appointment,AppointmentService,Payment}` (Task 2), `app.db.AsyncSessionLocal` (Task 1).
- Produces: `app.seed.load_seed_data.load_seed_data(session: AsyncSession) -> None` (idempotent — truncates and reloads all six tables from `seed_data/*.json`), `backend/tests/conftest.py`'s `db_session` fixture (an `AsyncSession` against a freshly-recreated `beauty_medspa_test` schema) — reused by every repository test in Tasks 4–8.

- [ ] **Step 1: Write `backend/tests/conftest.py`**

```python
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Base

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/beauty_medspa_test"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()
```

- [ ] **Step 2: Write `backend/app/seed/__init__.py`** (empty file)

- [ ] **Step 3: Write `backend/app/seed/load_seed_data.py`**

```python
import asyncio
import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal
from app.models import Appointment, AppointmentService, Patient, Payment, Provider, Service

SEED_DATA_DIR = Path(__file__).resolve().parents[3] / "seed_data"


def _load_json(filename: str) -> list[dict]:
    with open(SEED_DATA_DIR / filename) as f:
        return json.load(f)


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


async def load_seed_data(session: AsyncSession) -> None:
    await session.execute(delete(Payment))
    await session.execute(delete(AppointmentService))
    await session.execute(delete(Appointment))
    await session.execute(delete(Service))
    await session.execute(delete(Provider))
    await session.execute(delete(Patient))

    for row in _load_json("patient.json"):
        session.add(Patient(
            id=row["id"], first_name=row["first_name"], last_name=row["last_name"],
            date_of_birth=_parse_dt(row["date_of_birth"]), gender=row["gender"],
            address=row["address"], phone=row["phone"], email=row["email"],
            source=row["source"], created_date=_parse_dt(row["created_date"]),
        ))

    for row in _load_json("provider.json"):
        session.add(Provider(
            id=row["id"], first_name=row["first_name"], last_name=row["last_name"],
            email=row["email"], phone=row["phone"],
            created_date=_parse_dt(row["created_date"]),
        ))

    for row in _load_json("service.json"):
        session.add(Service(
            id=row["id"], name=row["name"], description=row["description"],
            price=row["price"], duration=row["duration"],
            created_date=_parse_dt(row["created_date"]),
        ))

    await session.flush()

    for row in _load_json("appointment.json"):
        session.add(Appointment(
            id=row["id"], patient_id=row["patient_id"], status=row["status"],
            created_date=_parse_dt(row["created_date"]),
        ))

    await session.flush()

    for row in _load_json("appointment_service.json"):
        session.add(AppointmentService(
            appointment_id=row["appointment_id"], service_id=row["service_id"],
            provider_id=row["provider_id"], start=_parse_dt(row["start"]),
            end=_parse_dt(row["end"]),
        ))

    for row in _load_json("payment.json"):
        session.add(Payment(
            id=row["id"], patient_id=row["patient_id"], amount=row["amount"],
            date=_parse_dt(row["date"]), method=row["method"], status=row["status"],
            provider_id=row["provider_id"], appointment_id=row["appointment_id"],
            service_id=row["service_id"], created_date=_parse_dt(row["created_date"]),
        ))

    await session.commit()


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await load_seed_data(session)


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 4: Write the failing test — `backend/tests/test_load_seed_data.py`**

```python
import json

from sqlalchemy import func, select

from app.models import Patient, Payment
from app.seed.load_seed_data import SEED_DATA_DIR, load_seed_data


def _expected_count(filename: str) -> int:
    return len(json.loads((SEED_DATA_DIR / filename).read_text()))


async def test_load_seed_data_inserts_all_patients_and_payments(db_session):
    await load_seed_data(db_session)

    actual_patients = (await db_session.execute(select(func.count(Patient.id)))).scalar_one()
    actual_payments = (await db_session.execute(select(func.count(Payment.id)))).scalar_one()

    assert actual_patients == _expected_count("patient.json")
    assert actual_payments == _expected_count("payment.json")


async def test_load_seed_data_is_idempotent(db_session):
    await load_seed_data(db_session)
    await load_seed_data(db_session)

    actual_patients = (await db_session.execute(select(func.count(Patient.id)))).scalar_one()
    assert actual_patients == _expected_count("patient.json")
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pytest tests/test_load_seed_data.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'app.seed'`) before Step 3 is saved — since these steps are written together here, instead run this after Step 3 is in place to confirm behavior; the meaningful check is that it fails if `SEED_DATA_DIR` pointed at the wrong path (verify by temporarily checking `SEED_DATA_DIR` resolves to the repo-root `seed_data/`).

- [ ] **Step 6: Run test to verify it passes**

Run: `pytest tests/test_load_seed_data.py -v`
Expected: PASS — both patient and payment counts match the JSON file lengths, and reload doesn't duplicate rows.

- [ ] **Step 7: Commit**

```bash
git add backend/app/seed backend/tests/conftest.py backend/tests/test_load_seed_data.py
git commit -m "feat(backend): add idempotent seed data loader"
```

---

## Task 4: Patient list repository, schema, and endpoint

**Files:**
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/patient.py`
- Create: `backend/app/repositories/__init__.py`
- Create: `backend/app/repositories/patients.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/patients.py`
- Create: `backend/tests/factories.py`
- Create: `backend/tests/test_patients_repository.py`
- Create: `backend/tests/test_patients_router.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `app.models.*` (Task 2), `app.db.get_db` (Task 1), `tests/conftest.py`'s `db_session` (Task 3).
- Produces: `app.repositories.patients.PatientFilters(search, source, gender)`, `app.repositories.patients.list_patients(db, filters, sort="name", page=1, page_size=25) -> PatientListResponse`, `GET /api/patients` endpoint, `tests/factories.py`'s `make_patient/make_provider/make_service/make_appointment/make_appointment_service/make_payment` (reused by Tasks 5–8).

- [ ] **Step 1: Write `backend/app/schemas/patient.py`**

```python
from datetime import date, datetime

from pydantic import BaseModel


class PatientListItem(BaseModel):
    id: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    phone: str
    email: str
    source: str
    created_date: datetime
    appointment_count: int
    last_appointment_date: datetime | None
    total_spent_cents: int


class PatientListResponse(BaseModel):
    items: list[PatientListItem]
    total: int
    page: int
    page_size: int
```

- [ ] **Step 2: Write `backend/app/schemas/__init__.py`** (empty file)

- [ ] **Step 3: Write `backend/tests/factories.py`**

```python
from datetime import datetime

from app.models import Appointment, AppointmentService, Patient, Payment, Provider, Service


def make_patient(id="pat_1", source="website", gender="female", created_date=None, date_of_birth=None):
    return Patient(
        id=id, first_name="Jane", last_name="Doe",
        date_of_birth=date_of_birth or datetime(1990, 1, 1), gender=gender,
        address="123 Main St", phone="555-0100", email=f"{id}@example.com",
        source=source, created_date=created_date or datetime.utcnow(),
    )


def make_provider(id="prv_1", first_name="Dr", last_name="Smith"):
    return Provider(
        id=id, first_name=first_name, last_name=last_name,
        email=f"{id}@example.com", phone="555-0000", created_date=datetime.utcnow(),
    )


def make_service(id="svc_1", name="Consultation", price=10000, duration=30):
    return Service(
        id=id, name=name, description=f"{name} description",
        price=price, duration=duration, created_date=datetime.utcnow(),
    )


def make_appointment(id="apt_1", patient_id="pat_1", status="confirmed", created_date=None):
    return Appointment(
        id=id, patient_id=patient_id, status=status,
        created_date=created_date or datetime.utcnow(),
    )


def make_appointment_service(appointment_id="apt_1", service_id="svc_1", provider_id="prv_1", start=None, end=None):
    return AppointmentService(
        appointment_id=appointment_id, service_id=service_id, provider_id=provider_id,
        start=start or datetime(2026, 1, 1, 9, 0),
        end=end or datetime(2026, 1, 1, 9, 30),
    )


def make_payment(id="pay_1", patient_id="pat_1", amount=10000, status="paid",
                  provider_id="prv_1", appointment_id="apt_1", service_id="svc_1", date=None):
    resolved_date = date or datetime.utcnow()
    return Payment(
        id=id, patient_id=patient_id, amount=amount, date=resolved_date,
        method="credit_card", status=status, provider_id=provider_id,
        appointment_id=appointment_id, service_id=service_id, created_date=resolved_date,
    )
```

- [ ] **Step 4: Write the failing test — `backend/tests/test_patients_repository.py`**

```python
from app.repositories.patients import PatientFilters, list_patients
from tests.factories import make_appointment, make_patient, make_payment, make_provider, make_service


async def test_list_patients_returns_paid_total_and_appointment_count(db_session):
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_1", patient_id="pat_1", amount=10000, status="paid"),
        make_payment(id="pay_2", patient_id="pat_1", amount=5000, status="failed"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters())

    assert result.total == 1
    item = result.items[0]
    assert item.appointment_count == 1
    assert item.total_spent_cents == 10000


async def test_list_patients_filters_by_source(db_session):
    db_session.add_all([
        make_patient(id="pat_1", source="instagram"),
        make_patient(id="pat_2", source="google"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters(source="instagram"))

    assert result.total == 1
    assert result.items[0].id == "pat_1"
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pytest tests/test_patients_repository.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.repositories'`

- [ ] **Step 6: Write `backend/app/repositories/patients.py`**

```python
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, Patient, Payment
from app.schemas.patient import PatientListItem, PatientListResponse


@dataclass
class PatientFilters:
    search: str | None = None
    source: str | None = None
    gender: str | None = None


async def list_patients(
    db: AsyncSession,
    filters: PatientFilters,
    sort: str = "name",
    page: int = 1,
    page_size: int = 25,
) -> PatientListResponse:
    appointment_counts = (
        select(Appointment.patient_id, func.count(Appointment.id).label("appointment_count"))
        .group_by(Appointment.patient_id)
        .subquery()
    )
    payment_totals = (
        select(Payment.patient_id, func.sum(Payment.amount).label("total_spent_cents"))
        .where(Payment.status == "paid")
        .group_by(Payment.patient_id)
        .subquery()
    )
    last_appointment = (
        select(Appointment.patient_id, func.max(Appointment.created_date).label("last_appointment_date"))
        .group_by(Appointment.patient_id)
        .subquery()
    )

    query = (
        select(
            Patient,
            func.coalesce(appointment_counts.c.appointment_count, 0).label("appointment_count"),
            func.coalesce(payment_totals.c.total_spent_cents, 0).label("total_spent_cents"),
            last_appointment.c.last_appointment_date,
        )
        .outerjoin(appointment_counts, appointment_counts.c.patient_id == Patient.id)
        .outerjoin(payment_totals, payment_totals.c.patient_id == Patient.id)
        .outerjoin(last_appointment, last_appointment.c.patient_id == Patient.id)
    )

    if filters.search:
        term = f"%{filters.search.lower()}%"
        query = query.where(
            func.lower(Patient.first_name + " " + Patient.last_name).like(term)
            | func.lower(Patient.email).like(term)
            | Patient.phone.like(f"%{filters.search}%")
        )
    if filters.source:
        query = query.where(Patient.source == filters.source)
    if filters.gender:
        query = query.where(Patient.gender == filters.gender)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()

    sort_columns = {
        "name": Patient.last_name.asc(),
        "created_date": Patient.created_date.desc(),
        "total_spent": func.coalesce(payment_totals.c.total_spent_cents, 0).desc(),
        "last_appointment_date": last_appointment.c.last_appointment_date.desc(),
    }
    query = query.order_by(sort_columns.get(sort, Patient.last_name.asc()))
    query = query.offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(query)).all()

    items = [
        PatientListItem(
            id=patient.id, first_name=patient.first_name, last_name=patient.last_name,
            date_of_birth=patient.date_of_birth.date(), gender=patient.gender,
            phone=patient.phone, email=patient.email, source=patient.source,
            created_date=patient.created_date, appointment_count=appointment_count,
            last_appointment_date=last_appt_date, total_spent_cents=total_spent_cents,
        )
        for patient, appointment_count, total_spent_cents, last_appt_date in rows
    ]

    return PatientListResponse(items=items, total=total, page=page, page_size=page_size)
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pytest tests/test_patients_repository.py -v`
Expected: PASS

- [ ] **Step 8: Write `backend/app/repositories/__init__.py`** (empty file)

- [ ] **Step 9: Write `backend/app/routers/patients.py`**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.patients import PatientFilters, list_patients
from app.schemas.patient import PatientListResponse

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=PatientListResponse)
async def get_patients(
    search: str | None = None,
    source: str | None = None,
    gender: str | None = None,
    sort: str = "name",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PatientListResponse:
    filters = PatientFilters(search=search, source=source, gender=gender)
    return await list_patients(db, filters, sort=sort, page=page, page_size=page_size)
```

- [ ] **Step 10: Write `backend/app/routers/__init__.py`** (empty file)

- [ ] **Step 11: Modify `backend/app/main.py`** (register the router)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import patients

app = FastAPI(title="Beauty Med Spa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(patients.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 12: Write the failing test — `backend/tests/test_patients_router.py`**

```python
from httpx import ASGITransport, AsyncClient

from app.db import get_db
from app.main import app
from tests.factories import make_patient


async def test_get_patients_endpoint_returns_list(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    db_session.add(make_patient(id="pat_1"))
    await db_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/patients")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == "pat_1"

    app.dependency_overrides.clear()
```

- [ ] **Step 13: Run test to verify it passes**

Run: `pytest tests/test_patients_router.py -v`
Expected: PASS

- [ ] **Step 14: Run the full backend test suite**

Run: `pytest -v`
Expected: all tests across Tasks 1–4 PASS

- [ ] **Step 15: Commit**

```bash
git add backend/app/schemas backend/app/repositories backend/app/routers backend/app/main.py backend/tests
git commit -m "feat(backend): add patient list repository, schema, and endpoint"
```

---

## Task 5: Analytics overview and revenue-over-time

**Files:**
- Create: `backend/app/schemas/analytics.py`
- Create: `backend/app/repositories/analytics.py`
- Create: `backend/app/routers/analytics.py`
- Create: `backend/tests/test_analytics_overview.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `tests/factories.py` (Task 4), `app.db.get_db` (Task 1).
- Produces: `app.repositories.analytics.get_overview_stats(db) -> OverviewStats`, `get_revenue_over_time(db) -> list[RevenuePoint]`, `GET /api/analytics/overview`, `GET /api/analytics/revenue-over-time`. Later analytics functions (Tasks 6–8) are added to this same `app/repositories/analytics.py` and `app/routers/analytics.py`.

- [ ] **Step 1: Write `backend/app/schemas/analytics.py`**

```python
from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_patients: int
    total_revenue_cents: int
    total_appointments: int
    avg_transaction_cents: int
    new_patients_last_30_days: int
    cancellation_rate: float


class RevenuePoint(BaseModel):
    period: str
    revenue_cents: int


class SourceBreakdownItem(BaseModel):
    source: str
    patient_count: int


class TopServiceItem(BaseModel):
    service_id: str
    service_name: str
    booking_count: int
    revenue_cents: int


class ProviderUtilizationItem(BaseModel):
    provider_id: str
    provider_name: str
    appointment_count: int
    revenue_cents: int


class AppointmentStatusItem(BaseModel):
    status: str
    count: int


class GenderCount(BaseModel):
    gender: str
    count: int


class AgeBucketCount(BaseModel):
    bucket: str
    count: int


class DemographicsResponse(BaseModel):
    gender_breakdown: list[GenderCount]
    age_buckets: list[AgeBucketCount]
```

- [ ] **Step 2: Write the failing test — `backend/tests/test_analytics_overview.py`**

```python
from datetime import datetime

from app.repositories.analytics import get_overview_stats, get_revenue_over_time
from tests.factories import make_appointment, make_patient, make_payment, make_provider, make_service


async def test_overview_counts_only_paid_revenue_and_computes_cancellation_rate(db_session):
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_2", patient_id="pat_1", status="cancelled"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_1", amount=10000, status="paid", appointment_id="apt_1"),
        make_payment(id="pay_2", amount=5000, status="failed", appointment_id="apt_1"),
    ])
    await db_session.commit()

    stats = await get_overview_stats(db_session)

    assert stats.total_patients == 1
    assert stats.total_appointments == 2
    assert stats.total_revenue_cents == 10000
    assert stats.avg_transaction_cents == 10000
    assert stats.cancellation_rate == 0.5


async def test_revenue_over_time_groups_paid_payments_by_month(db_session):
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_1", amount=10000, status="paid", date=datetime(2026, 1, 15)),
        make_payment(id="pay_2", amount=20000, status="paid", date=datetime(2026, 1, 20)),
        make_payment(id="pay_3", amount=5000, status="paid", date=datetime(2026, 2, 1)),
    ])
    await db_session.commit()

    points = await get_revenue_over_time(db_session)

    assert {p.period: p.revenue_cents for p in points} == {"2026-01": 30000, "2026-02": 5000}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_analytics_overview.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.repositories.analytics'`

- [ ] **Step 4: Write `backend/app/repositories/analytics.py`**

```python
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Appointment, Patient, Payment
from app.schemas.analytics import OverviewStats, RevenuePoint


async def get_overview_stats(db: AsyncSession) -> OverviewStats:
    total_patients = (await db.execute(select(func.count(Patient.id)))).scalar_one()

    paid = select(Payment.amount).where(Payment.status == "paid").subquery()
    total_revenue = (await db.execute(select(func.coalesce(func.sum(paid.c.amount), 0)))).scalar_one()
    paid_count = (await db.execute(select(func.count()).select_from(paid))).scalar_one()
    avg_transaction = int(total_revenue / paid_count) if paid_count else 0

    total_appointments = (await db.execute(select(func.count(Appointment.id)))).scalar_one()

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    new_patients = (await db.execute(
        select(func.count(Patient.id)).where(Patient.created_date >= thirty_days_ago)
    )).scalar_one()

    cancelled_count = (await db.execute(
        select(func.count(Appointment.id)).where(Appointment.status == "cancelled")
    )).scalar_one()
    cancellation_rate = (cancelled_count / total_appointments) if total_appointments else 0.0

    return OverviewStats(
        total_patients=total_patients,
        total_revenue_cents=int(total_revenue),
        total_appointments=total_appointments,
        avg_transaction_cents=avg_transaction,
        new_patients_last_30_days=new_patients,
        cancellation_rate=round(cancellation_rate, 4),
    )


async def get_revenue_over_time(db: AsyncSession) -> list[RevenuePoint]:
    period = func.to_char(Payment.date, "YYYY-MM").label("period")
    query = (
        select(period, func.sum(Payment.amount).label("revenue_cents"))
        .where(Payment.status == "paid")
        .group_by(period)
        .order_by(period)
    )
    rows = (await db.execute(query)).all()
    return [RevenuePoint(period=row.period, revenue_cents=int(row.revenue_cents)) for row in rows]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_analytics_overview.py -v`
Expected: PASS

- [ ] **Step 6: Write `backend/app/routers/analytics.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories import analytics as analytics_repo
from app.schemas.analytics import OverviewStats, RevenuePoint

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewStats)
async def overview(db: AsyncSession = Depends(get_db)) -> OverviewStats:
    return await analytics_repo.get_overview_stats(db)


@router.get("/revenue-over-time", response_model=list[RevenuePoint])
async def revenue_over_time(db: AsyncSession = Depends(get_db)) -> list[RevenuePoint]:
    return await analytics_repo.get_revenue_over_time(db)
```

- [ ] **Step 7: Modify `backend/app/main.py`** (register the analytics router)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import analytics, patients

app = FastAPI(title="Beauty Med Spa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(analytics.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 8: Run the full backend test suite**

Run: `pytest -v`
Expected: all tests PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas/analytics.py backend/app/repositories/analytics.py backend/app/routers/analytics.py backend/app/main.py backend/tests/test_analytics_overview.py
git commit -m "feat(backend): add analytics overview and revenue-over-time"
```

---

## Task 6: Patients-by-source and top-services

**Files:**
- Modify: `backend/app/repositories/analytics.py`
- Modify: `backend/app/routers/analytics.py`
- Create: `backend/tests/test_analytics_source_and_services.py`

**Interfaces:**
- Produces: `get_patients_by_source(db) -> list[SourceBreakdownItem]`, `get_top_services(db, limit=10) -> list[TopServiceItem]`, `GET /api/analytics/patients-by-source`, `GET /api/analytics/top-services`.

- [ ] **Step 1: Write the failing test — `backend/tests/test_analytics_source_and_services.py`**

```python
from app.repositories.analytics import get_patients_by_source, get_top_services
from tests.factories import (
    make_appointment,
    make_appointment_service,
    make_patient,
    make_payment,
    make_provider,
    make_service,
)


async def test_patients_by_source_counts_per_source(db_session):
    db_session.add_all([
        make_patient(id="pat_1", source="instagram"),
        make_patient(id="pat_2", source="instagram"),
        make_patient(id="pat_3", source="google"),
    ])
    await db_session.commit()

    rows = await get_patients_by_source(db_session)

    assert {r.source: r.patient_count for r in rows} == {"instagram": 2, "google": 1}


async def test_top_services_does_not_double_count_revenue_across_multiple_bookings(db_session):
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(id="svc_1", name="Facial"),
        make_appointment(id="apt_1", patient_id="pat_1"),
        make_appointment(id="apt_2", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_1", service_id="svc_1"),
        make_appointment_service(appointment_id="apt_2", service_id="svc_1"),
    ])
    db_session.add(make_payment(id="pay_1", amount=15000, status="paid", appointment_id="apt_1", service_id="svc_1"))
    await db_session.commit()

    rows = await get_top_services(db_session)

    assert len(rows) == 1
    assert rows[0].booking_count == 2
    assert rows[0].revenue_cents == 15000
```

This second test guards against the join fan-out bug called out in the design doc: two `appointment_services` bookings joined naively against one payment on `service_id` would produce 2 result rows, doubling `revenue_cents` to 30000. The independent-subquery approach below avoids that.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_analytics_source_and_services.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_patients_by_source'`

- [ ] **Step 3: Add to `backend/app/repositories/analytics.py`**

```python
from app.models import AppointmentService, Service
from app.schemas.analytics import SourceBreakdownItem, TopServiceItem


async def get_patients_by_source(db: AsyncSession) -> list[SourceBreakdownItem]:
    query = (
        select(Patient.source, func.count(Patient.id).label("patient_count"))
        .group_by(Patient.source)
        .order_by(func.count(Patient.id).desc())
    )
    rows = (await db.execute(query)).all()
    return [SourceBreakdownItem(source=row.source, patient_count=row.patient_count) for row in rows]


async def get_top_services(db: AsyncSession, limit: int = 10) -> list[TopServiceItem]:
    bookings = (
        select(AppointmentService.service_id, func.count(AppointmentService.id).label("booking_count"))
        .group_by(AppointmentService.service_id)
        .subquery()
    )
    revenue = (
        select(Payment.service_id, func.sum(Payment.amount).label("revenue_cents"))
        .where(Payment.status == "paid")
        .group_by(Payment.service_id)
        .subquery()
    )
    query = (
        select(
            Service.id.label("service_id"),
            Service.name.label("service_name"),
            func.coalesce(bookings.c.booking_count, 0).label("booking_count"),
            func.coalesce(revenue.c.revenue_cents, 0).label("revenue_cents"),
        )
        .outerjoin(bookings, bookings.c.service_id == Service.id)
        .outerjoin(revenue, revenue.c.service_id == Service.id)
        .order_by(func.coalesce(bookings.c.booking_count, 0).desc())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [
        TopServiceItem(
            service_id=row.service_id, service_name=row.service_name,
            booking_count=row.booking_count, revenue_cents=int(row.revenue_cents),
        )
        for row in rows
    ]
```

Add `AppointmentService, Service` to the existing `from app.models import ...` line at the top of the file instead of a second import line, and `SourceBreakdownItem, TopServiceItem` to the existing `from app.schemas.analytics import ...` line.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_analytics_source_and_services.py -v`
Expected: PASS

- [ ] **Step 5: Add to `backend/app/routers/analytics.py`**

```python
from app.schemas.analytics import SourceBreakdownItem, TopServiceItem


@router.get("/patients-by-source", response_model=list[SourceBreakdownItem])
async def patients_by_source(db: AsyncSession = Depends(get_db)) -> list[SourceBreakdownItem]:
    return await analytics_repo.get_patients_by_source(db)


@router.get("/top-services", response_model=list[TopServiceItem])
async def top_services(db: AsyncSession = Depends(get_db)) -> list[TopServiceItem]:
    return await analytics_repo.get_top_services(db)
```

Merge `SourceBreakdownItem, TopServiceItem` into the existing schema import line rather than adding a duplicate import.

- [ ] **Step 6: Run the full backend test suite**

Run: `pytest -v`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/repositories/analytics.py backend/app/routers/analytics.py backend/tests/test_analytics_source_and_services.py
git commit -m "feat(backend): add patients-by-source and top-services analytics"
```

---

## Task 7: Provider utilization and appointment status breakdown

**Files:**
- Modify: `backend/app/repositories/analytics.py`
- Modify: `backend/app/routers/analytics.py`
- Create: `backend/tests/test_analytics_providers_and_status.py`

**Interfaces:**
- Produces: `get_provider_utilization(db) -> list[ProviderUtilizationItem]`, `get_appointment_status_breakdown(db) -> list[AppointmentStatusItem]`, `GET /api/analytics/provider-utilization`, `GET /api/analytics/appointment-status`.

- [ ] **Step 1: Write the failing test — `backend/tests/test_analytics_providers_and_status.py`**

```python
from app.repositories.analytics import get_appointment_status_breakdown, get_provider_utilization
from tests.factories import (
    make_appointment,
    make_appointment_service,
    make_patient,
    make_payment,
    make_provider,
    make_service,
)


async def test_provider_utilization_does_not_double_count_revenue(db_session):
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(id="prv_1"), make_service(id="svc_1"),
        make_appointment(id="apt_1", patient_id="pat_1"),
        make_appointment(id="apt_2", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_1", provider_id="prv_1", service_id="svc_1"),
        make_appointment_service(appointment_id="apt_2", provider_id="prv_1", service_id="svc_1"),
    ])
    db_session.add(make_payment(id="pay_1", amount=20000, status="paid", provider_id="prv_1", appointment_id="apt_1"))
    await db_session.commit()

    rows = await get_provider_utilization(db_session)

    assert len(rows) == 1
    assert rows[0].appointment_count == 2
    assert rows[0].revenue_cents == 20000


async def test_appointment_status_breakdown_counts_each_status(db_session):
    db_session.add_all([
        make_patient(id="pat_1"),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_2", patient_id="pat_1", status="cancelled"),
        make_appointment(id="apt_3", patient_id="pat_1", status="cancelled"),
    ])
    await db_session.commit()

    rows = await get_appointment_status_breakdown(db_session)

    assert {r.status: r.count for r in rows} == {"confirmed": 1, "cancelled": 2}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_analytics_providers_and_status.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_provider_utilization'`

- [ ] **Step 3: Add to `backend/app/repositories/analytics.py`**

```python
from app.models import Provider
from app.schemas.analytics import AppointmentStatusItem, ProviderUtilizationItem


async def get_provider_utilization(db: AsyncSession) -> list[ProviderUtilizationItem]:
    appointment_counts = (
        select(AppointmentService.provider_id, func.count(AppointmentService.id).label("appointment_count"))
        .group_by(AppointmentService.provider_id)
        .subquery()
    )
    revenue = (
        select(Payment.provider_id, func.sum(Payment.amount).label("revenue_cents"))
        .where(Payment.status == "paid")
        .group_by(Payment.provider_id)
        .subquery()
    )
    query = (
        select(
            Provider.id.label("provider_id"),
            (Provider.first_name + " " + Provider.last_name).label("provider_name"),
            func.coalesce(appointment_counts.c.appointment_count, 0).label("appointment_count"),
            func.coalesce(revenue.c.revenue_cents, 0).label("revenue_cents"),
        )
        .outerjoin(appointment_counts, appointment_counts.c.provider_id == Provider.id)
        .outerjoin(revenue, revenue.c.provider_id == Provider.id)
        .order_by(func.coalesce(appointment_counts.c.appointment_count, 0).desc())
    )
    rows = (await db.execute(query)).all()
    return [
        ProviderUtilizationItem(
            provider_id=row.provider_id, provider_name=row.provider_name,
            appointment_count=row.appointment_count, revenue_cents=int(row.revenue_cents),
        )
        for row in rows
    ]


async def get_appointment_status_breakdown(db: AsyncSession) -> list[AppointmentStatusItem]:
    query = select(Appointment.status, func.count(Appointment.id).label("count")).group_by(Appointment.status)
    rows = (await db.execute(query)).all()
    return [AppointmentStatusItem(status=row.status, count=row.count) for row in rows]
```

Merge `Provider` into the existing `app.models` import and `AppointmentStatusItem, ProviderUtilizationItem` into the existing `app.schemas.analytics` import.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_analytics_providers_and_status.py -v`
Expected: PASS

- [ ] **Step 5: Add to `backend/app/routers/analytics.py`**

```python
from app.schemas.analytics import AppointmentStatusItem, ProviderUtilizationItem


@router.get("/provider-utilization", response_model=list[ProviderUtilizationItem])
async def provider_utilization(db: AsyncSession = Depends(get_db)) -> list[ProviderUtilizationItem]:
    return await analytics_repo.get_provider_utilization(db)


@router.get("/appointment-status", response_model=list[AppointmentStatusItem])
async def appointment_status(db: AsyncSession = Depends(get_db)) -> list[AppointmentStatusItem]:
    return await analytics_repo.get_appointment_status_breakdown(db)
```

Merge into the existing schema import line.

- [ ] **Step 6: Run the full backend test suite**

Run: `pytest -v`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/repositories/analytics.py backend/app/routers/analytics.py backend/tests/test_analytics_providers_and_status.py
git commit -m "feat(backend): add provider utilization and appointment status analytics"
```

---

## Task 8: Patient demographics

**Files:**
- Modify: `backend/app/repositories/analytics.py`
- Modify: `backend/app/routers/analytics.py`
- Create: `backend/tests/test_analytics_demographics.py`

**Interfaces:**
- Produces: `get_patient_demographics(db) -> DemographicsResponse`, `GET /api/analytics/demographics`.

- [ ] **Step 1: Write the failing test — `backend/tests/test_analytics_demographics.py`**

```python
from datetime import datetime

from app.repositories.analytics import get_patient_demographics
from tests.factories import make_patient


async def test_demographics_buckets_by_gender_and_age(db_session):
    now = datetime.utcnow()
    db_session.add_all([
        make_patient(id="pat_1", gender="female", date_of_birth=now.replace(year=now.year - 30)),
        make_patient(id="pat_2", gender="male", date_of_birth=now.replace(year=now.year - 60)),
    ])
    await db_session.commit()

    result = await get_patient_demographics(db_session)

    assert {g.gender: g.count for g in result.gender_breakdown} == {"female": 1, "male": 1}
    buckets = {b.bucket: b.count for b in result.age_buckets}
    assert buckets["25-34"] == 1
    assert buckets["55-64"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_analytics_demographics.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_patient_demographics'`

- [ ] **Step 3: Add to `backend/app/repositories/analytics.py`**

```python
from sqlalchemy import case, extract
from app.schemas.analytics import AgeBucketCount, DemographicsResponse, GenderCount


async def get_patient_demographics(db: AsyncSession) -> DemographicsResponse:
    gender_rows = (await db.execute(
        select(Patient.gender, func.count(Patient.id).label("count")).group_by(Patient.gender)
    )).all()
    gender_breakdown = [GenderCount(gender=row.gender, count=row.count) for row in gender_rows]

    age_years = extract("year", func.age(func.now(), Patient.date_of_birth))
    bucket = case(
        (age_years < 25, "18-24"),
        (age_years < 35, "25-34"),
        (age_years < 45, "35-44"),
        (age_years < 55, "45-54"),
        (age_years < 65, "55-64"),
        else_="65+",
    ).label("bucket")
    bucket_rows = (await db.execute(
        select(bucket, func.count(Patient.id).label("count")).group_by(bucket)
    )).all()
    age_buckets = [AgeBucketCount(bucket=row.bucket, count=row.count) for row in bucket_rows]

    return DemographicsResponse(gender_breakdown=gender_breakdown, age_buckets=age_buckets)
```

Merge `case, extract` into the existing `sqlalchemy` import line at the top of the file, and `AgeBucketCount, DemographicsResponse, GenderCount` into the existing `app.schemas.analytics` import.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_analytics_demographics.py -v`
Expected: PASS

- [ ] **Step 5: Add to `backend/app/routers/analytics.py`**

```python
from app.schemas.analytics import DemographicsResponse


@router.get("/demographics", response_model=DemographicsResponse)
async def demographics(db: AsyncSession = Depends(get_db)) -> DemographicsResponse:
    return await analytics_repo.get_patient_demographics(db)
```

Merge into the existing schema import line.

- [ ] **Step 6: Run the full backend test suite**

Run: `pytest -v`
Expected: all tests PASS — this completes the backend.

- [ ] **Step 7: Commit**

```bash
git add backend/app/repositories/analytics.py backend/app/routers/analytics.py backend/tests/test_analytics_demographics.py
git commit -m "feat(backend): add patient demographics analytics"
```

---

## Task 9: Frontend scaffolding

**Files:**
- Create: `frontend/` (via `create-next-app`)
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/api.ts`
- Create: `frontend/app/providers.tsx`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/page.tsx`
- Create: `frontend/.env.example`

**Interfaces:**
- Produces: `api.getPatients/getOverview/getRevenueOverTime/getPatientsBySource/getTopServices/getProviderUtilization/getAppointmentStatus/getDemographics` (typed fetch wrappers in `lib/api.ts`), all TS interfaces in `lib/types.ts` matching Tasks 4–8's Pydantic schemas exactly, a `<QueryClientProvider>` wrapping the app.

- [ ] **Step 1: Scaffold the Next.js app**

Run (from repo root):
```bash
npx create-next-app@14 frontend --typescript --tailwind --app --no-src-dir --eslint --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Install additional dependencies**

Run (from `frontend/`):
```bash
npm install @tanstack/react-query recharts
```

- [ ] **Step 3: Write `frontend/lib/types.ts`**

```typescript
export interface PatientListItem {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email: string;
  source: string;
  created_date: string;
  appointment_count: number;
  last_appointment_date: string | null;
  total_spent_cents: number;
}

export interface PatientListResponse {
  items: PatientListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface OverviewStats {
  total_patients: number;
  total_revenue_cents: number;
  total_appointments: number;
  avg_transaction_cents: number;
  new_patients_last_30_days: number;
  cancellation_rate: number;
}

export interface RevenuePoint {
  period: string;
  revenue_cents: number;
}

export interface SourceBreakdownItem {
  source: string;
  patient_count: number;
}

export interface TopServiceItem {
  service_id: string;
  service_name: string;
  booking_count: number;
  revenue_cents: number;
}

export interface ProviderUtilizationItem {
  provider_id: string;
  provider_name: string;
  appointment_count: number;
  revenue_cents: number;
}

export interface AppointmentStatusItem {
  status: string;
  count: number;
}

export interface GenderCount {
  gender: string;
  count: number;
}

export interface AgeBucketCount {
  bucket: string;
  count: number;
}

export interface DemographicsResponse {
  gender_breakdown: GenderCount[];
  age_buckets: AgeBucketCount[];
}
```

- [ ] **Step 4: Write `frontend/lib/api.ts`**

```typescript
import type {
  AppointmentStatusItem,
  DemographicsResponse,
  OverviewStats,
  PatientListResponse,
  ProviderUtilizationItem,
  RevenuePoint,
  SourceBreakdownItem,
  TopServiceItem,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export interface PatientQueryParams {
  search?: string;
  source?: string;
  gender?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

export const api = {
  getPatients: (params: PatientQueryParams) => apiGet<PatientListResponse>("/api/patients", { ...params }),
  getOverview: () => apiGet<OverviewStats>("/api/analytics/overview"),
  getRevenueOverTime: () => apiGet<RevenuePoint[]>("/api/analytics/revenue-over-time"),
  getPatientsBySource: () => apiGet<SourceBreakdownItem[]>("/api/analytics/patients-by-source"),
  getTopServices: () => apiGet<TopServiceItem[]>("/api/analytics/top-services"),
  getProviderUtilization: () => apiGet<ProviderUtilizationItem[]>("/api/analytics/provider-utilization"),
  getAppointmentStatus: () => apiGet<AppointmentStatusItem[]>("/api/analytics/appointment-status"),
  getDemographics: () => apiGet<DemographicsResponse>("/api/analytics/demographics"),
};
```

- [ ] **Step 5: Write `frontend/app/providers.tsx`**

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 6: Modify `frontend/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beauty Med Spa Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <nav className="flex gap-6 border-b bg-white px-6 py-4">
            <Link href="/patients" className="font-medium hover:text-teal-600">
              Patients
            </Link>
            <Link href="/analytics" className="font-medium hover:text-teal-600">
              Analytics
            </Link>
          </nav>
          <main className="p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Modify `frontend/app/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/patients");
}
```

- [ ] **Step 8: Write `frontend/.env.example`**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Step 9: Manual verification**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors (the `/patients` and `/analytics` routes don't exist yet — that's expected until Tasks 10–14; the build itself must still succeed since `redirect()` doesn't validate the target at build time).

- [ ] **Step 10: Commit**

```bash
git add frontend
git commit -m "feat(frontend): scaffold Next.js app with API client and nav layout"
```

---

## Task 10: Patient Table page

**Files:**
- Create: `frontend/components/patients/PatientFilters.tsx`
- Create: `frontend/components/patients/PatientTable.tsx`
- Create: `frontend/app/patients/page.tsx`

**Interfaces:**
- Consumes: `api.getPatients` and `PatientQueryParams` (Task 9), `PatientListItem` type (Task 9).
- Produces: the `/patients` route.

- [ ] **Step 1: Write `frontend/components/patients/PatientFilters.tsx`**

```tsx
"use client";

import type { PatientQueryParams } from "@/lib/api";

const SOURCES = ["in_person", "phone", "instagram", "tiktok", "google", "website"];
const GENDERS = ["male", "female", "other"];
const SORTS = [
  { value: "name", label: "Name" },
  { value: "created_date", label: "Newest" },
  { value: "total_spent", label: "Total Spent" },
  { value: "last_appointment_date", label: "Last Appointment" },
];

interface Props {
  filters: PatientQueryParams;
  onChange: (next: Partial<PatientQueryParams>) => void;
}

export function PatientFilters({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3 rounded-lg border bg-white p-4">
      <input
        type="text"
        placeholder="Search name, email, or phone"
        className="min-w-[200px] flex-1 rounded border px-3 py-2 text-sm"
        defaultValue={filters.search ?? ""}
        onChange={(e) => onChange({ search: e.target.value })}
      />
      <select
        className="rounded border px-3 py-2 text-sm"
        value={filters.source ?? ""}
        onChange={(e) => onChange({ source: e.target.value || undefined })}
      >
        <option value="">All sources</option>
        {SOURCES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        className="rounded border px-3 py-2 text-sm"
        value={filters.gender ?? ""}
        onChange={(e) => onChange({ gender: e.target.value || undefined })}
      >
        <option value="">All genders</option>
        {GENDERS.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
      <select
        className="rounded border px-3 py-2 text-sm"
        value={filters.sort ?? "name"}
        onChange={(e) => onChange({ sort: e.target.value })}
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>Sort: {s.label}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/components/patients/PatientTable.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, type PatientQueryParams } from "@/lib/api";
import { PatientFilters } from "./PatientFilters";

const PAGE_SIZE = 25;

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function PatientTable() {
  const [filters, setFilters] = useState<PatientQueryParams>({ page: 1, page_size: PAGE_SIZE, sort: "name" });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", filters],
    queryFn: () => api.getPatients(filters),
  });

  return (
    <div className="space-y-4">
      <PatientFilters filters={filters} onChange={(next) => setFilters({ ...filters, ...next, page: 1 })} />

      {isLoading && <p className="text-slate-500">Loading patients…</p>}
      {isError && <p className="text-red-600">Could not load patients. Please try again.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Gender</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Created</th>
                  <th className="p-3"># Appointments</th>
                  <th className="p-3">Last Appointment</th>
                  <th className="p-3">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      No patients match these filters.
                    </td>
                  </tr>
                )}
                {data.items.map((patient) => (
                  <tr key={patient.id} className="border-t">
                    <td className="p-3">{patient.first_name} {patient.last_name}</td>
                    <td className="p-3 capitalize">{patient.gender}</td>
                    <td className="p-3">{patient.phone}</td>
                    <td className="p-3">{patient.email}</td>
                    <td className="p-3 capitalize">{patient.source}</td>
                    <td className="p-3">{formatDate(patient.created_date)}</td>
                    <td className="p-3">{patient.appointment_count}</td>
                    <td className="p-3">{formatDate(patient.last_appointment_date)}</td>
                    <td className="p-3">{formatCents(patient.total_spent_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Showing {(data.page - 1) * data.page_size + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded border px-3 py-1 disabled:opacity-40"
                disabled={data.page <= 1}
                onClick={() => setFilters({ ...filters, page: data.page - 1 })}
              >
                Previous
              </button>
              <button
                className="rounded border px-3 py-1 disabled:opacity-40"
                disabled={data.page * data.page_size >= data.total}
                onClick={() => setFilters({ ...filters, page: data.page + 1 })}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `frontend/app/patients/page.tsx`**

```tsx
import { PatientTable } from "@/components/patients/PatientTable";

export default function PatientsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Patients</h1>
      <PatientTable />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

With the backend running (`uvicorn app.main:app --reload` from `backend/`, seed data loaded per Task 3) and frontend running (`npm run dev` from `frontend/`):
1. Visit `http://localhost:3000` — confirm it redirects to `/patients`.
2. Confirm the table renders with real patient rows, correct column values, and a working paginator (Previous/Next).
3. Type into the search box — confirm the list filters after a moment.
4. Change the source and gender dropdowns — confirm the list filters correctly and the "no patients match" empty state appears for an impossible combination (e.g., search for a nonsense string).
5. Change the sort dropdown to "Total Spent" — confirm ordering changes.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/patients frontend/app/patients
git commit -m "feat(frontend): add patient table page with filters, sort, and pagination"
```

---

## Task 11: Analytics KPI row

**Files:**
- Create: `frontend/components/analytics/KpiCard.tsx`
- Create: `frontend/app/analytics/page.tsx`

**Interfaces:**
- Consumes: `api.getOverview` (Task 9).
- Produces: the `/analytics` route (extended by Tasks 12–14), `KpiCard` component reused only here.

- [ ] **Step 1: Write `frontend/components/analytics/KpiCard.tsx`**

```tsx
interface Props {
  label: string;
  value: string;
}

export function KpiCard({ label, value }: Props) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/app/analytics/page.tsx`**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { KpiCard } from "@/components/analytics/KpiCard";
import { api } from "@/lib/api";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AnalyticsPage() {
  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: api.getOverview,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      {isLoading && <p className="text-slate-500">Loading overview…</p>}
      {isError && <p className="text-red-600">Could not load analytics overview.</p>}

      {overview && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total Patients" value={overview.total_patients.toLocaleString()} />
          <KpiCard label="Total Revenue" value={formatCents(overview.total_revenue_cents)} />
          <KpiCard label="Total Appointments" value={overview.total_appointments.toLocaleString()} />
          <KpiCard label="Avg. Transaction" value={formatCents(overview.avg_transaction_cents)} />
          <KpiCard label="New Patients (30d)" value={overview.new_patients_last_30_days.toLocaleString()} />
          <KpiCard label="Cancellation Rate" value={`${(overview.cancellation_rate * 100).toFixed(1)}%`} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Visit `http://localhost:3000/analytics`. Confirm all six KPI cards render with real numbers (not zero/NaN), currency values are formatted as dollars, and the cancellation rate shows as a percentage.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/analytics/KpiCard.tsx frontend/app/analytics/page.tsx
git commit -m "feat(frontend): add analytics KPI row"
```

---

## Task 12: Revenue and source-breakdown charts

**Files:**
- Create: `frontend/components/analytics/RevenueChart.tsx`
- Create: `frontend/components/analytics/SourceBreakdownChart.tsx`
- Modify: `frontend/app/analytics/page.tsx`

**Interfaces:**
- Consumes: `api.getRevenueOverTime`, `api.getPatientsBySource` (Task 9).

- [ ] **Step 1: Write `frontend/components/analytics/RevenueChart.tsx`**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";

export function RevenueChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "revenue-over-time"],
    queryFn: api.getRevenueOverTime,
  });

  if (isLoading) return <p className="text-slate-500">Loading revenue trend…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No revenue data yet.</p>;

  const chartData = data.map((point) => ({ period: point.period, revenue: point.revenue_cents / 100 }));

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Revenue Over Time</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
          <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
          <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/components/analytics/SourceBreakdownChart.tsx`**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";

const COLORS = ["#0f766e", "#0891b2", "#7c3aed", "#db2777", "#d97706", "#65a30d"];

export function SourceBreakdownChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "patients-by-source"],
    queryFn: api.getPatientsBySource,
  });

  if (isLoading) return <p className="text-slate-500">Loading source breakdown…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No patient source data yet.</p>;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">How Patients Find Us</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="patient_count" nameKey="source" outerRadius={100} label>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Modify `frontend/app/analytics/page.tsx`** (add both charts below the KPI row)

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { KpiCard } from "@/components/analytics/KpiCard";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { SourceBreakdownChart } from "@/components/analytics/SourceBreakdownChart";
import { api } from "@/lib/api";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AnalyticsPage() {
  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: api.getOverview,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      {isLoading && <p className="text-slate-500">Loading overview…</p>}
      {isError && <p className="text-red-600">Could not load analytics overview.</p>}

      {overview && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total Patients" value={overview.total_patients.toLocaleString()} />
          <KpiCard label="Total Revenue" value={formatCents(overview.total_revenue_cents)} />
          <KpiCard label="Total Appointments" value={overview.total_appointments.toLocaleString()} />
          <KpiCard label="Avg. Transaction" value={formatCents(overview.avg_transaction_cents)} />
          <KpiCard label="New Patients (30d)" value={overview.new_patients_last_30_days.toLocaleString()} />
          <KpiCard label="Cancellation Rate" value={`${(overview.cancellation_rate * 100).toFixed(1)}%`} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart />
        <SourceBreakdownChart />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Reload `/analytics`. Confirm the revenue line chart shows a plausible monthly trend and the source pie chart shows all six source categories with a legend.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/analytics/RevenueChart.tsx frontend/components/analytics/SourceBreakdownChart.tsx frontend/app/analytics/page.tsx
git commit -m "feat(frontend): add revenue and source-breakdown charts"
```

---

## Task 13: Top-services and provider-utilization charts

**Files:**
- Create: `frontend/components/analytics/TopServicesChart.tsx`
- Create: `frontend/components/analytics/ProviderUtilizationChart.tsx`
- Modify: `frontend/app/analytics/page.tsx`

**Interfaces:**
- Consumes: `api.getTopServices`, `api.getProviderUtilization` (Task 9).

- [ ] **Step 1: Write `frontend/components/analytics/TopServicesChart.tsx`**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";

export function TopServicesChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "top-services"],
    queryFn: api.getTopServices,
  });

  if (isLoading) return <p className="text-slate-500">Loading top services…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No service data yet.</p>;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Top Services by Bookings</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="service_name" width={140} />
          <Tooltip />
          <Bar dataKey="booking_count" fill="#0f766e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/components/analytics/ProviderUtilizationChart.tsx`**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";

export function ProviderUtilizationChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "provider-utilization"],
    queryFn: api.getProviderUtilization,
  });

  if (isLoading) return <p className="text-slate-500">Loading provider utilization…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No provider data yet.</p>;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Provider Utilization</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="provider_name" width={140} />
          <Tooltip />
          <Bar dataKey="appointment_count" fill="#0891b2" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Modify `frontend/app/analytics/page.tsx`** (add both charts in a second grid row)

Add these imports:
```tsx
import { ProviderUtilizationChart } from "@/components/analytics/ProviderUtilizationChart";
import { TopServicesChart } from "@/components/analytics/TopServicesChart";
```

And append after the existing `<RevenueChart />` / `<SourceBreakdownChart />` grid:
```tsx
      <div className="grid gap-4 md:grid-cols-2">
        <TopServicesChart />
        <ProviderUtilizationChart />
      </div>
```

- [ ] **Step 4: Manual verification**

Reload `/analytics`. Confirm both horizontal bar charts render with service/provider names on the Y-axis and plausible counts.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/analytics/TopServicesChart.tsx frontend/components/analytics/ProviderUtilizationChart.tsx frontend/app/analytics/page.tsx
git commit -m "feat(frontend): add top-services and provider-utilization charts"
```

---

## Task 14: Appointment status and demographics charts

**Files:**
- Create: `frontend/components/analytics/AppointmentStatusChart.tsx`
- Create: `frontend/components/analytics/DemographicsChart.tsx`
- Modify: `frontend/app/analytics/page.tsx`

**Interfaces:**
- Consumes: `api.getAppointmentStatus`, `api.getDemographics` (Task 9).

- [ ] **Step 1: Write `frontend/components/analytics/AppointmentStatusChart.tsx`**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#0f766e",
  pending: "#d97706",
  cancelled: "#dc2626",
};

export function AppointmentStatusChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "appointment-status"],
    queryFn: api.getAppointmentStatus,
  });

  if (isLoading) return <p className="text-slate-500">Loading appointment status…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No appointment data yet.</p>;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Appointment Status</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" outerRadius={100} label>
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#64748b"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/components/analytics/DemographicsChart.tsx`**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";

export function DemographicsChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "demographics"],
    queryFn: api.getDemographics,
  });

  if (isLoading) return <p className="text-slate-500">Loading demographics…</p>;
  if (!data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-4 font-medium">Patients by Gender</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.gender_breakdown}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="gender" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#7c3aed" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-4 font-medium">Patients by Age Group</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.age_buckets}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#db2777" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Modify `frontend/app/analytics/page.tsx`** (final version — full file)

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { AppointmentStatusChart } from "@/components/analytics/AppointmentStatusChart";
import { DemographicsChart } from "@/components/analytics/DemographicsChart";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ProviderUtilizationChart } from "@/components/analytics/ProviderUtilizationChart";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { SourceBreakdownChart } from "@/components/analytics/SourceBreakdownChart";
import { TopServicesChart } from "@/components/analytics/TopServicesChart";
import { api } from "@/lib/api";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AnalyticsPage() {
  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: api.getOverview,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      {isLoading && <p className="text-slate-500">Loading overview…</p>}
      {isError && <p className="text-red-600">Could not load analytics overview.</p>}

      {overview && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total Patients" value={overview.total_patients.toLocaleString()} />
          <KpiCard label="Total Revenue" value={formatCents(overview.total_revenue_cents)} />
          <KpiCard label="Total Appointments" value={overview.total_appointments.toLocaleString()} />
          <KpiCard label="Avg. Transaction" value={formatCents(overview.avg_transaction_cents)} />
          <KpiCard label="New Patients (30d)" value={overview.new_patients_last_30_days.toLocaleString()} />
          <KpiCard label="Cancellation Rate" value={`${(overview.cancellation_rate * 100).toFixed(1)}%`} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart />
        <SourceBreakdownChart />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TopServicesChart />
        <ProviderUtilizationChart />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AppointmentStatusChart />
      </div>

      <DemographicsChart />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification (full analytics page)**

Reload `/analytics` and confirm, top to bottom: KPI row → revenue/source charts → top-services/provider charts → appointment-status pie → gender/age bar charts. Resize the browser to ~400px width and confirm the grid stacks to one column with no horizontal scrolling. Then re-check the Patient Table page (Task 10) at the same width for the same responsiveness.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/analytics/AppointmentStatusChart.tsx frontend/components/analytics/DemographicsChart.tsx frontend/app/analytics/page.tsx
git commit -m "feat(frontend): add appointment status and demographics charts, completing analytics page"
```

---

## Task 14b: Payment status breakdown and top-services revenue view

> **Inserted post-hoc during Task 14's review.** The design doc's "Client question → Dashboard content" table (docs/superpowers/specs/2026-09-09-patient-dashboard-design.md) promises two pieces of content that never made it into the design doc's own concrete "Endpoints" list, and were therefore never scoped into any of Tasks 5-14: a payment status breakdown (paid/pending/failed), and a top-services view by revenue (not just booking volume — `TopServiceItem.revenue_cents` already exists in the schema/API, it's just never charted). This task closes both gaps using the exact same patterns already established and reviewed in Tasks 7 (appointment status) and 13 (top-services chart).

**Files:**
- Modify: `backend/app/schemas/analytics.py`
- Modify: `backend/app/repositories/analytics.py`
- Modify: `backend/app/routers/analytics.py`
- Create: `backend/tests/test_analytics_payment_status.py`
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/lib/api.ts`
- Create: `frontend/components/analytics/PaymentStatusChart.tsx`
- Create: `frontend/components/analytics/TopServicesRevenueChart.tsx`
- Modify: `frontend/app/analytics/page.tsx`

**Interfaces:**
- Produces: `get_payment_status_breakdown(db) -> list[PaymentStatusItem]`, `GET /api/analytics/payment-status`, `api.getPaymentStatus()`, `PaymentStatusChart`, `TopServicesRevenueChart`.

- [ ] **Step 1: Add to `backend/app/schemas/analytics.py`**

```python
class PaymentStatusItem(BaseModel):
    status: str
    count: int
```

- [ ] **Step 2: Write the failing test — `backend/tests/test_analytics_payment_status.py`**

```python
from app.repositories.analytics import get_payment_status_breakdown
from tests.factories import make_appointment, make_patient, make_payment, make_provider, make_service


async def test_payment_status_breakdown_counts_each_status(db_session):
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_1", status="paid"),
        make_payment(id="pay_2", status="pending"),
        make_payment(id="pay_3", status="pending"),
        make_payment(id="pay_4", status="failed"),
    ])
    await db_session.commit()

    rows = await get_payment_status_breakdown(db_session)

    assert {r.status: r.count for r in rows} == {"paid": 1, "pending": 2, "failed": 1}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_analytics_payment_status.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_payment_status_breakdown'`

- [ ] **Step 4: Add to `backend/app/repositories/analytics.py`**

```python
async def get_payment_status_breakdown(db: AsyncSession) -> list[PaymentStatusItem]:
    query = select(Payment.status, func.count(Payment.id).label("count")).group_by(Payment.status)
    rows = (await db.execute(query)).all()
    return [PaymentStatusItem(status=row.status, count=row.count) for row in rows]
```

Merge `PaymentStatusItem` into the existing `from app.schemas.analytics import ...` line. `Payment` and `func`/`select` are already imported in this file from earlier tasks.

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_analytics_payment_status.py -v`
Expected: PASS

- [ ] **Step 6: Add to `backend/app/routers/analytics.py`**

```python
@router.get("/payment-status", response_model=list[PaymentStatusItem])
async def payment_status(db: AsyncSession = Depends(get_db)) -> list[PaymentStatusItem]:
    return await analytics_repo.get_payment_status_breakdown(db)
```

Merge `PaymentStatusItem` into the existing schema import line.

- [ ] **Step 7: Run the full backend test suite**

Run: `pytest -v`
Expected: all tests PASS (14 total: 13 pre-existing + 1 new)

- [ ] **Step 8: Add to `frontend/lib/types.ts`**

```typescript
export interface PaymentStatusItem {
  status: string;
  count: number;
}
```

- [ ] **Step 9: Add to `frontend/lib/api.ts`**

Add `PaymentStatusItem` to the existing type import line, and add to the `api` object:

```typescript
  getPaymentStatus: () => apiGet<PaymentStatusItem[]>("/api/analytics/payment-status"),
```

- [ ] **Step 10: Write `frontend/components/analytics/PaymentStatusChart.tsx`**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  pending: "#d97706",
  failed: "#dc2626",
};

export function PaymentStatusChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "payment-status"],
    queryFn: api.getPaymentStatus,
  });

  if (isLoading) return <p className="text-slate-500">Loading payment status…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No payment data yet.</p>;

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Payment Status</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" outerRadius={100} label>
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#64748b"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 11: Write `frontend/components/analytics/TopServicesRevenueChart.tsx`**

This reuses the same `api.getTopServices` data Task 13's `TopServicesChart` already fetches (same query key, so TanStack Query dedupes the network request), just re-sorted by revenue instead of booking count. Uses the same `tickFormatter`/`formatter` cast pattern already established and reviewed in Task 12's `RevenueChart` (Recharts' actual types don't accept a plain `number`-typed callback parameter).

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";

export function TopServicesRevenueChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "top-services"],
    queryFn: api.getTopServices,
  });

  if (isLoading) return <p className="text-slate-500">Loading top services…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No service data yet.</p>;

  const chartData = [...data]
    .sort((a, b) => b.revenue_cents - a.revenue_cents)
    .map((item) => ({ service_name: item.service_name, revenue: item.revenue_cents / 100 }));

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Top Services by Revenue</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={(v) => `$${(v as number).toLocaleString()}`} />
          <YAxis type="category" dataKey="service_name" width={140} />
          <Tooltip formatter={(v) => `$${(v as number).toLocaleString()}`} />
          <Bar dataKey="revenue" fill="#0891b2" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 12: Modify `frontend/app/analytics/page.tsx`** (final version — full file)

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { AppointmentStatusChart } from "@/components/analytics/AppointmentStatusChart";
import { DemographicsChart } from "@/components/analytics/DemographicsChart";
import { KpiCard } from "@/components/analytics/KpiCard";
import { PaymentStatusChart } from "@/components/analytics/PaymentStatusChart";
import { ProviderUtilizationChart } from "@/components/analytics/ProviderUtilizationChart";
import { RevenueChart } from "@/components/analytics/RevenueChart";
import { SourceBreakdownChart } from "@/components/analytics/SourceBreakdownChart";
import { TopServicesChart } from "@/components/analytics/TopServicesChart";
import { TopServicesRevenueChart } from "@/components/analytics/TopServicesRevenueChart";
import { api } from "@/lib/api";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function AnalyticsPage() {
  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: api.getOverview,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>

      {isLoading && <p className="text-slate-500">Loading overview…</p>}
      {isError && <p className="text-red-600">Could not load analytics overview.</p>}

      {overview && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total Patients" value={overview.total_patients.toLocaleString()} />
          <KpiCard label="Total Revenue" value={formatCents(overview.total_revenue_cents)} />
          <KpiCard label="Total Appointments" value={overview.total_appointments.toLocaleString()} />
          <KpiCard label="Avg. Transaction" value={formatCents(overview.avg_transaction_cents)} />
          <KpiCard label="New Patients (30d)" value={overview.new_patients_last_30_days.toLocaleString()} />
          <KpiCard label="Cancellation Rate" value={`${(overview.cancellation_rate * 100).toFixed(1)}%`} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart />
        <SourceBreakdownChart />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TopServicesChart />
        <ProviderUtilizationChart />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TopServicesRevenueChart />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AppointmentStatusChart />
        <PaymentStatusChart />
      </div>

      <DemographicsChart />
    </div>
  );
}
```

Note this also fixes a pre-existing layout oddity: Task 14 left `AppointmentStatusChart` alone in a 2-column grid row; it's now paired with the new `PaymentStatusChart`.

- [ ] **Step 13: Manual verification**

Reload `/analytics`. Confirm the new "Top Services by Revenue" chart and "Payment Status" pie both render with real data, and the page now fully matches every row of the design doc's "Client question → Dashboard content" table.

- [ ] **Step 14: Commit**

```bash
git add backend/app/schemas/analytics.py backend/app/repositories/analytics.py backend/app/routers/analytics.py backend/tests/test_analytics_payment_status.py frontend/lib/types.ts frontend/lib/api.ts frontend/components/analytics/PaymentStatusChart.tsx frontend/components/analytics/TopServicesRevenueChart.tsx frontend/app/analytics/page.tsx
git commit -m "feat: add payment status breakdown and top-services revenue view, closing design-doc coverage gap"
```

---

## Task 15: Load seed data locally and deploy backend to Railway

**Files:**
- Create: `backend/Dockerfile`
- Modify: `backend/.env.example` (no content change needed if already correct; verify)

**Interfaces:**
- Produces: a publicly reachable backend URL serving all endpoints from Tasks 1–8 against real seeded data.

- [ ] **Step 1: Load seed data into the local dev database**

Run (from `backend/`, with `docker compose up -d` running and `alembic upgrade head` already applied to `beauty_medspa`):
```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/beauty_medspa python -m app.seed.load_seed_data
```
Expected: script completes without error.

- [ ] **Step 2: Manual verification against local data**

Run: `uvicorn app.main:app --reload` (from `backend/`), then:
```bash
curl http://localhost:8000/api/patients | head -c 500
curl http://localhost:8000/api/analytics/overview
```
Expected: real JSON with ~4000 total patients and non-zero revenue figures.

- [ ] **Step 3: Write `backend/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY . .

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

- [ ] **Step 4: Push to GitHub** (if not already)

```bash
git add backend/Dockerfile
git commit -m "chore(backend): add Dockerfile for Railway deployment"
git push
```

- [ ] **Step 5: Create the Railway project**

In the Railway dashboard: create a new project, add a **Postgres** plugin, then add a service from the GitHub repo with **root directory** set to `backend`. Railway will detect the `Dockerfile` and build from it.

- [ ] **Step 6: Configure backend environment variables on Railway**

Set on the Railway service:
- `DATABASE_URL` — take the Postgres plugin's connection string and change its scheme from `postgresql://` to `postgresql+asyncpg://` (Railway's default string uses the sync scheme; the app requires the asyncpg dialect).
- `CORS_ORIGINS` — set to `*` temporarily; this gets tightened to the real Vercel origin in Task 16.

- [ ] **Step 7: Deploy and verify migrations ran**

Trigger a deploy. The `Dockerfile`'s `CMD` runs `alembic upgrade head` before starting `uvicorn`, so a successful deploy means the schema exists. Confirm via Railway's deploy logs.

- [ ] **Step 8: Run the seed loader once against the Railway database**

Using the Railway CLI (`railway login`, `railway link` to the project):
```bash
railway run python -m app.seed.load_seed_data
```
Expected: completes without error. This is a one-off command, not part of the deploy step — rerunning the deploy afterward does not re-seed.

- [ ] **Step 9: Manual verification against the deployed backend**

```bash
curl https://<railway-app>.up.railway.app/api/health
curl https://<railway-app>.up.railway.app/api/analytics/overview
```
Expected: `{"status": "ok"}` and real aggregate figures matching Step 2's local output.

- [ ] **Step 10: Commit**

```bash
git add backend/Dockerfile
git commit -m "chore(backend): add Railway deployment configuration"
```

(If Step 4 already committed the Dockerfile, this step is a no-op — skip if there's nothing new to commit.)

---

## Task 16: Deploy frontend to Vercel and close the loop

**Files:**
- None (deployment configuration only, plus README update deferred to Task 17)

**Interfaces:**
- Produces: a publicly reachable Vercel URL serving the full app against the Railway backend.

- [ ] **Step 1: Import the project into Vercel**

In the Vercel dashboard: import the GitHub repo, set **root directory** to `frontend`, framework preset "Next.js" (auto-detected).

- [ ] **Step 2: Set the frontend environment variable**

Set `NEXT_PUBLIC_API_URL` to the Railway backend URL from Task 15 (e.g. `https://<railway-app>.up.railway.app`).

- [ ] **Step 3: Deploy**

Trigger the Vercel deploy and wait for it to complete.

- [ ] **Step 4: Tighten backend CORS to the real Vercel origin**

Back in Railway, update `CORS_ORIGINS` from `*` to the exact Vercel deployment origin (e.g. `https://beauty-medspa.vercel.app`), then redeploy the backend service so the new env var takes effect.

- [ ] **Step 5: Manual end-to-end verification on the live deployment**

Visit the live Vercel URL:
1. Confirm `/patients` loads real data, and filtering/sorting/pagination all work against the live backend (not localhost).
2. Confirm `/analytics` loads all six KPI cards and all six charts with real data.
3. Open browser devtools Network tab and confirm no CORS errors and no requests to `localhost`.

- [ ] **Step 6: Note the live URLs for the README**

Record the final Vercel URL and the GitHub repo URL — both go into Task 17's README.

---

## Task 17: README

**Files:**
- Modify: `README.md`

**Interfaces:**
- None — this is the final documentation task.

- [ ] **Step 1: Write `README.md`**

```markdown
# Beauty Med Spa Patient Dashboard

A read-only patient dashboard for Beauty Med Spa: a filterable/sortable patient table and an analytics dashboard, built on top of the client's existing `seed_data/` JSON fixtures.

**Live app:** <VERCEL_URL>
**Backend API:** <RAILWAY_URL>

## Architecture

- `backend/` — FastAPI + async SQLAlchemy + Alembic, PostgreSQL. Routes are thin wrappers over a typed repository/query layer (`backend/app/repositories/`) — the same functions a future AI-driven query service would call as tools.
- `frontend/` — Next.js 14 (App Router) + TypeScript + Tailwind + TanStack Query + Recharts.
- `seed_data/` — the client-provided JSON fixtures, migrated into Postgres once via `backend/app/seed/load_seed_data.py`. The running app only ever reads from Postgres.

See `docs/superpowers/specs/2026-09-09-patient-dashboard-design.md` for the full design rationale.

## Local Development

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
docker compose up -d
alembic upgrade head
python -m app.seed.load_seed_data
uvicorn app.main:app --reload
```

**Frontend** (in a separate terminal):
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Visit `http://localhost:3000`.

## Running Tests

Backend (requires `docker compose up -d` from the backend setup above):
```bash
cd backend
pytest -v
```

Frontend has no automated test suite (see Future Enhancements) — verify manually per the steps in the implementation plan.

## Deployment

- Backend + Postgres: Railway (see `backend/Dockerfile`; migrations run automatically on deploy, seed data loaded once via a manual `railway run` command).
- Frontend: Vercel, with `NEXT_PUBLIC_API_URL` pointing at the Railway backend.

## Future Enhancements

- A patient detail page/endpoint (the spec named only the Patient Table and Analytics Dashboard as required pages).
- The actual AI-driven natural-language query service — the current repository layer (`backend/app/repositories/`) is structured so this can call the same typed, parameterized functions the REST endpoints use, rather than needing raw SQL access.
- An automated frontend test suite (component/interaction tests) — currently relies on manual verification given the project deadline.
- Materialized views or precomputed summary tables for the analytics endpoints, if data volume grows well beyond the current ~4,000 patients.
- Access control on the deployed app if this were ever to serve real (non-synthetic) patient data.
```

- [ ] **Step 2: Fill in the actual URLs**

Replace `<VERCEL_URL>` and `<RAILWAY_URL>` with the real URLs from Tasks 15–16.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: write README with setup, deployment, and future enhancements"
```

---

## Self-Review Notes

- **Spec coverage**: every section of the design doc has a corresponding task — schema (Task 2), seed migration (Task 3), patient list + AI-ready repository seam (Task 4), all six analytics endpoints (Tasks 5–8), both required frontend pages (Tasks 10, 11–14), deployment to Railway+Vercel (Tasks 15–16), and the README (Task 17).
- **Fan-out correctness**: `get_top_services` and `get_provider_utilization` (Tasks 6–7) deliberately aggregate `appointment_services` and `payments` in independent subqueries before joining, with tests that would fail if a naive single-join implementation double-counted revenue — this was the single highest-risk correctness area called out in the design doc's testing strategy.
- **Type consistency**: `PatientListItem`, `OverviewStats`, `RevenuePoint`, `SourceBreakdownItem`, `TopServiceItem`, `ProviderUtilizationItem`, `AppointmentStatusItem`, `GenderCount`, `AgeBucketCount`, and `DemographicsResponse` are defined once (Tasks 4–5) and their field names are used identically in the repositories, routers, and the frontend's `lib/types.ts` (Task 9) — verified by re-reading each usage while writing this plan.
- **Styling deviation flagged**: the design doc mentioned shadcn/ui; this plan hand-writes Tailwind components instead, noted explicitly in Global Constraints, so the deviation is visible rather than silent.
