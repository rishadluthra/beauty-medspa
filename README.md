# Beauty Med Spa Patient Dashboard

A read-only patient dashboard for Beauty Med Spa: a filterable/sortable patient table and an analytics dashboard, built on top of the client's existing `seed_data/` JSON fixtures.

**Live app:** https://frontend-khaki-five-88.vercel.app
**Backend API:** https://backend-production-1d3cc.up.railway.app

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

- Backend + Postgres: Railway (see `backend/Dockerfile`; migrations run automatically on deploy, seed data loaded once via a manual one-off command).
- Frontend: Vercel, with `NEXT_PUBLIC_API_URL` pointing at the Railway backend. CORS on the backend is scoped to the deployed Vercel origin plus `localhost` for local dev.

## Future Enhancements

- A patient detail page/endpoint (the spec named only the Patient Table and Analytics Dashboard as required pages).
- The actual AI-driven natural-language query service — the current repository layer (`backend/app/repositories/`) is structured so this can call the same typed, parameterized functions the REST endpoints use, rather than needing raw SQL access.
- An automated frontend test suite (component/interaction tests) — currently relies on manual verification given the project deadline.
- Materialized views or precomputed summary tables for the analytics endpoints, if data volume grows well beyond the current ~4,000 patients.
- Access control on the deployed app if this were ever to serve real (non-synthetic) patient data.
- Consistent phone number and date formatting, and consistent capitalization, across the patient table and analytics displays.
