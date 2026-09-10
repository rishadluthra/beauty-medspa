# Beauty Med Spa Patient Dashboard — Design

**Status**: Approved, pending implementation plan
**Source of truth**: `docs/SPEC.md` (client spec), `models.py` (data contract)

## Context

Beauty Med Spa (a client of Decoda) has patient/appointment/service/provider/payment data in flat JSON files and wants a dashboard to understand their patients and business performance. This is a take-home evaluation with a deadline; the evaluation weighs attention to detail, ability to orchestrate AI, and design sense heavily (see CLAUDE.md's "Evaluation hint"). The deliverable must be a deployed, publicly accessible app (DB + backend + frontend) plus a GitHub repo link and a README.

Two pages are required: a filterable/sortable **Patient Table** and an open-ended **Analytics Dashboard**. A third requirement — "AI-ready architecture" — is explicitly deferred: the actual arbitrary-question service gets built live during the technical interview. For this build, the job is to make the architecture obviously easy to extend that way, not to build the AI service itself.

## Scope decisions (from planning conversation)

- **Timeline**: take-home with a real deadline — optimize for a complete, deployed, working app over maximal feature exploration.
- **Deployment**: Vercel (frontend) + Railway (backend + Postgres).
- **AI-readiness**: architecture only for now (a clean, typed, reusable query layer) — no working NL-to-SQL/agent service built in this phase.
- **Access control**: fully open, no auth — the deployed data is synthetic seed data, not real PHI.
- **No patient-detail page/endpoint** — spec names exactly two required pages; a detail view is called out as a future enhancement in the README rather than built now.

## Repo structure

Monorepo, matching the spec's single "GitHub link to the repository" deliverable:

```
beauty-medspa/
  backend/
    app/
      main.py            # FastAPI app + CORS setup
      db.py              # async engine/session
      models/            # SQLAlchemy ORM models
      schemas/           # Pydantic API request/response schemas
      repositories/       # query layer (patients.py, analytics.py) — the AI-ready seam
      routers/            # FastAPI route handlers, thin — call repositories, return schemas
      seed/                # load_seed_data.py — ingests seed_data/*.json
    alembic/               # DB migrations
    tests/
    pyproject.toml
    docker-compose.yml     # local Postgres for dev
    .env.example
  frontend/
    app/                  # Next.js 14 App Router
      layout.tsx           # shared nav: Patients | Analytics
      patients/page.tsx
      analytics/page.tsx
    components/
      patients/PatientTable.tsx, PatientFilters.tsx
      analytics/KpiCard.tsx, RevenueChart.tsx, SourceBreakdownChart.tsx,
                TopServicesChart.tsx, ProviderUtilizationChart.tsx,
                AppointmentStatusChart.tsx, DemographicsChart.tsx
    lib/
      api.ts                # typed fetch wrappers to the FastAPI backend
      types.ts              # TS types mirroring backend Pydantic schemas
    package.json
    .env.example
  seed_data/               # unchanged — original JSON fixtures
  models.py                # unchanged — client-provided contract; ORM models mirror it
  docs/SPEC.md
```

## Database schema

Tables mirror `models.py` 1:1, using the existing prefixed string IDs (`pat_*`, `prv_*`, `svc_*`, `apt_*`, `pay_*`) as primary keys rather than introducing surrogate integer PKs, since the seed data's foreign-key references already use them.

- `patients` — PK `id`. Indexed on `source`, `created_date`.
- `providers` — PK `id`.
- `services` — PK `id`.
- `appointments` — PK `id`, FK `patient_id → patients.id`. Indexed on `patient_id`, `status`.
- `appointment_services` — the many-to-many join. Has no natural PK in `models.py`, so a surrogate `id` (serial, DB-only concern, not part of the client's data contract) is added. FKs to `appointment_id`, `service_id`, `provider_id`. Indexed on all three FKs and on `start` (date-range analytics queries).
- `payments` — PK `id`, FKs to `patient_id`, `provider_id`, `appointment_id`, `service_id`. Indexed on `patient_id`, `appointment_id`, `date`, `status` (analytics filters heavily on paid vs. pending/failed).

Money stays integer cents end-to-end (matches `models.py`); the frontend formats to dollars for display only.

## Seed data migration

One-time migration, not a live sync:

1. Alembic migrations create the empty schema in Postgres.
2. `backend/app/seed/load_seed_data.py` reads the six `seed_data/*.json` files and bulk-inserts them in FK-safe order: patients/providers/services → appointments → appointment_services → payments.
3. From that point on, Postgres is the sole source of truth — the running app never reads the JSON files. They remain in the repo as the original fixture.

The script is idempotent (truncate-and-reload) so it can be rerun safely after a schema change. It runs twice in practice: once locally during development, and once against the Railway Postgres instance after the schema is first deployed there.

## Backend API & data-access layer

**Repository layer** (`backend/app/repositories/`) is the AI-readiness seam: each function is a typed, parameterized, read-only query. These are the same functions a future agent's "tools" would call — the REST routes are just one caller of them.

- `patients.py`: `list_patients(filters, sort, page, page_size)`
- `analytics.py`: `get_overview_stats()`, `get_revenue_over_time(interval)`, `get_patients_by_source()`, `get_top_services()`, `get_provider_utilization()`, `get_appointment_status_breakdown()`, `get_patient_demographics()`

Routers stay thin: parse query params into a filter object, call the repository function, return the Pydantic schema. No business logic lives in route handlers.

**Patient list performance**: showing appointment count / last-appointment-date / lifetime-spend per patient in a paginated list requires aggregating `appointments`/`payments` without N+1 queries at 4k-patient scale. Use `LEFT JOIN` against `GROUP BY patient_id` aggregate subqueries for appointment count and paid-revenue sum, computed once, then paginated over.

**Endpoints:**
- `GET /api/patients` — params: `search`, `source`, `gender`, `sort`, `page`, `page_size`. Returns paginated list including per-patient aggregates.
- `GET /api/analytics/overview` — total patients, total revenue, total appointments, avg. transaction value, new patients (last 30 days), cancellation rate.
- `GET /api/analytics/revenue-over-time`
- `GET /api/analytics/patients-by-source`
- `GET /api/analytics/top-services`
- `GET /api/analytics/provider-utilization`
- `GET /api/analytics/appointment-status`
- `GET /api/analytics/demographics`

## Frontend architecture

Next.js 14 App Router + TypeScript, Tailwind CSS + shadcn/ui (matches the calming/professional, generous-whitespace aesthetic referenced from decodahealth.com), Recharts for charts, TanStack Query for client-side data fetching/caching across filter/sort/paginate interactions.

### Patient Table page

Columns chosen for front-desk usefulness: Name, Age (derived from DOB), Gender, Phone, Email, Source, Created Date, # Appointments, Last Appointment Date, Total Spent (lifetime paid revenue).

Filters: search (name/email/phone), source, gender, created-date range.
Sort: name, created date, total spent, last appointment date.
Pagination: server-side throughout — the full 4,000-patient set is never fetched or sorted client-side.

### Analytics Dashboard page

Content maps directly to the questions the spec says the client wants answered:

| Client question | Dashboard content |
|---|---|
| Who are our patients? | Demographics: gender split, age distribution |
| How are patients finding us? | Patient source breakdown chart + KPI: new patients (30d) |
| What services are popular? | Top services by volume and by revenue |
| How's the business doing financially? | KPI row (total revenue, avg. transaction, total appointments) + revenue-over-time chart + payment status breakdown (paid/pending/failed) |
| Which providers are busiest? | Provider utilization: appointment count & revenue per provider |
| Patterns in patient/appointment behavior? | Appointment status breakdown (pending/confirmed/cancelled) as a proxy for cancellation rate / operational health |

Layout: a top KPI card row (Total Patients, Total Revenue, Total Appointments, Avg. Transaction Value, New Patients 30d, Cancellation Rate), then charts below in a responsive grid.

## Deployment

- **Railway**: managed Postgres add-on + the FastAPI backend as a service (Nixpacks/Dockerfile, `uvicorn` entrypoint). Alembic migrations run automatically on deploy (release step). The seed-loading script is run once manually via a Railway one-off command after the first successful deploy — not on every deploy/restart.
- **Vercel**: the Next.js frontend, with `NEXT_PUBLIC_API_URL` pointing at the Railway backend's public URL.
- **CORS**: FastAPI allows the Vercel domain (and `localhost` for local dev) as origins.
- **Local dev**: `docker-compose.yml` for a local Postgres instance; `.env.example` in both `backend/` and `frontend/` documenting required vars (`DATABASE_URL`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`).

## Testing strategy

Pragmatic, scaled to the deadline:

- **Backend**: pytest + pytest-asyncio against a real test Postgres (via docker-compose), focused on the repository layer — pagination correctness, aggregate math (revenue sums, counts, top-N), and filter behavior. This is where a subtle bug (e.g. double-counting revenue via a join fan-out) would actually hide.
- **Frontend**: no automated test suite given the deadline. Manual verification of the golden path plus edge cases (empty states, loading states, error states, zero-result filters) in-browser before calling any page done.

## Explicitly out of scope for this phase

- The working AI/NL-to-SQL query service itself (built live during the technical interview; only the repository-layer seam is prepared now).
- Patient detail page/endpoint.
- Create/update/delete functionality of any kind (spec is read-only).
- Auth/access gating on the deployed app.
- Automated frontend test suite.
