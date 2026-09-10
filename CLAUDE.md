# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Pre-implementation. The repo currently contains only the spec (`docs/SPEC.md`), the data model contract (`models.py`), and raw seed data (`seed_data/*.json`) — no package manifest, backend, frontend, or build tooling exists yet. There are no build/lint/test commands to document until that scaffolding is created.

When the backend/frontend are scaffolded, regenerate this file (`/init`) so it reflects real commands and structure instead of this placeholder.

## Evaluation hint (from the client contact)

> The bulk of our evaluation is about your attention to detail, ability to orchestrate AI, and demonstrate a keen sense of design.

Weight decisions accordingly: sweat details (edge cases in the data, correct handling of unpaid appointments, cancelled statuses, empty states), lean into the "AI-ready architecture" angle rather than treating it as an afterthought, and don't under-invest in visual/UX polish relative to backend correctness.

## Git workflow

Commit aggressively as work progresses (working scaffold, each meaningful step of schema/backend/frontend/analytics work) — git history is the fallback checkpoint to revert to if a later change goes wrong, not just an end-of-task formality.

## North star

**`docs/SPEC.md` is the source of truth for what to build.** It's a client project (Beauty Med Spa, a client of Decoda) requesting a patient dashboard. Every implementation decision should trace back to it. Key points from the spec:

- **Deliverable**: A relational database loaded from `seed_data/`, a Python backend API, and a Next.js frontend — with a Patient Table page and an Analytics Dashboard page.
- **Read-only**: The client only needs to *view* data. No create/update/delete functionality is required.
- **AI-ready architecture**: Code should be structured so that, during the technical interview, it's straightforward to add a service that answers arbitrary natural-language questions over the data. This should inform how the data-access layer is factored (e.g., not hiding everything behind bespoke per-page endpoints with no reusable query layer).
- **Scale**: ~4,000 patients plus associated appointments/services/providers/payments — query efficiency, pagination, and indexing matter, not just correctness.
- **Technical constraints** (per spec, don't deviate without asking): Python 3.10+, async Python, async SQLAlchemy for the backend; Next.js 14 + React + TypeScript for the frontend; PostgreSQL for the database.
- **Design reference**: follow the visual style of https://www.decodahealth.com/ — calming/professional/healthcare-appropriate, generous whitespace, responsive.
- **Deliverables** include a deployed, publicly accessible app (DB + backend + frontend), a GitHub repo link, and a README documenting thoughts/future enhancements — this isn't just a local demo.

## Data model (`models.py`)

`models.py` defines the domain as Pydantic models; this is the contract the database schema and seed loader must match. Entities and relationships:

- **Patient** — `id` (`pat_*`), demographics, `source` (marketing channel: in_person/phone/instagram/tiktok/google/website). One patient → many appointments, many payments.
- **Provider** — `id` (`prv_*`), the staff member performing a service.
- **Service** — `id` (`svc_*`), a billable offering (`price` in cents, `duration` in minutes).
- **Appointment** — `id` (`apt_*`), belongs to one `patient_id`, has a `status` (pending/confirmed/cancelled). It does **not** directly hold service/provider/time info — that lives one level down.
- **AppointmentService** — the join entity: links one `appointment_id` to a `service_id` + `provider_id`, with its own `start`/`end` time. An appointment can have multiple of these (e.g., consultation → blood test → X-ray), each potentially with a different provider. This is the many-to-many hinge of the whole schema.
- **Payment** — `id` (`pay_*`... see seed data), linked to `patient_id`, `provider_id`, `appointment_id`, and `service_id` (the *primary* service for that appointment — not every service on it). `amount` in cents. Not every appointment has a payment (some are unpaid); payments also have their own `status` (pending/paid/failed) independent of appointment status.

Money is always integer cents throughout (`Payment.amount`, `Service.price`) — never floats.

## Seed data (`seed_data/`)

One JSON array per entity, matching `models.py` 1:1: `patient.json`, `provider.json`, `service.json`, `appointment.json`, `appointment_service.json`, `payment.json`. IDs are prefixed strings (`pat_`, `prv_`, `svc_`, `apt_`) rather than integers/UUIDs — preserve these as natural/business keys or map them deliberately; don't assume surrogate integer PKs align with anything meaningful. This is the data a future ingestion script loads into PostgreSQL — there is no live seed generator, so schema changes must stay backward-compatible with this fixed JSON shape (or the loader must transform it explicitly).
