# Beauty Med Spa Patient Dashboard

A read-only patient dashboard for Beauty Med Spa, built on top of the client's existing `seed_data/` JSON fixtures. The Front Desk page covers Today's Appointments, a Calendar view, Walk-In Availability, a filterable/sortable All Patients table (with per-column-type operators — text/number/date/enum), and Rebooking Opportunities, plus patient/appointment detail pages. The Analytics page covers the KPIs and visualizations a manager needs (revenue, patient demographics, marketing source, top services, provider utilization, retention/cancellation) plus an ad-hoc custom-graph builder and saveable custom views.

**Live app:** https://frontend-khaki-five-88.vercel.app

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

- **Chatbot** - An integrated RAG chatbot or some such, that both the front desk agent and manager could query.
- **Authentication & role-based access control** — the API is currently fully open. Production use would need real auth, with front desk vs. manager roles likely seeing different levels of data (e.g. revenue figures).
- **CRUD support** — the spec scoped this to read-only, but real day-to-day use would need create/update/delete for appointments, patients, and payments, not just viewing them. I decided to implement it for the analytics page as a bonus, so that the med spa manager can create their own dashboards and graphs based on the data most important to them.
