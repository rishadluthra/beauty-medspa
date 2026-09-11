"""FastAPI application entrypoint.

Creates the app, wires up CORS and the feature routers, and exposes a
health-check endpoint. This is the module an ASGI server (e.g. uvicorn)
points at to run the API.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import analytics, appointments, availability, custom_reports, patients, providers, services

app = FastAPI(title="Beauty Med Spa API")

# Restrict cross-origin requests to the known frontend origin(s) rather than
# allowing "*" — still shouldn't be callable from arbitrary origins. Every
# route is GET-only EXCEPT `app.routers.custom_reports` (the self-serve
# "Build Custom Analytics" feature's saved-report CRUD, POST/DELETE) — the
# spec's read-only note is scope relief on the seed *business* data, not a
# blanket prohibition on app-level state, so POST/DELETE are widened in
# specifically to support that one feature. `cors_origins` is a
# comma-separated string (env var) so it can be set to just the deployed
# Next.js frontend's URL in production while defaulting to localhost for
# local dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# Feature routers, each owning a URL prefix/tag; kept as separate modules so
# the data-access layer they depend on stays reusable rather than bespoke
# per-endpoint logic (see app/routers and the query layer they call).
app.include_router(patients.router)
app.include_router(appointments.router)
app.include_router(analytics.router)
app.include_router(providers.router)
app.include_router(services.router)
app.include_router(availability.router)
app.include_router(custom_reports.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    """Liveness check used by the deployment platform/uptime checks."""
    return {"status": "ok"}
