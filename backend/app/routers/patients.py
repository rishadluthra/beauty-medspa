"""HTTP routes for patient listing.

Thin wrapper over `app.repositories.patients`: parses/validates query
params and delegates all filtering/sorting/pagination/aggregation logic to
the repository layer (see `app.repositories.__init__` for why that split
matters — the repository functions are meant to be reusable outside the
REST layer too).
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.patients import PatientFilters, get_patient_detail, list_patients, list_upcoming_appointments
from app.schemas.patient import PatientDetailResponse, PatientListResponse, UpcomingAppointmentsResponse

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=PatientListResponse)
async def get_patients(
    search: str | None = None,
    source: str | None = None,
    gender: str | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    age_min: int | None = Query(None, ge=0),
    age_max: int | None = Query(None, ge=0),
    sort: str = "name",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> PatientListResponse:
    """List patients for the Patient Table page.

    Supports free-text search (name/email/phone), exact-match filters
    (source, gender), a created-date range (created_from/created_to, both
    inclusive), an age range (age_min/age_max, both inclusive, computed
    from date_of_birth as of today), sorting, and pagination — all applied
    server-side by `list_patients`. `page_size` is capped at 100 to keep
    responses bounded.
    """
    filters = PatientFilters(
        search=search, source=source, gender=gender, created_from=created_from, created_to=created_to,
        age_min=age_min, age_max=age_max,
    )
    return await list_patients(db, filters, sort=sort, page=page, page_size=page_size)


# Registered BEFORE `/{patient_id}` below -- FastAPI matches routes in
# registration order, so a static "/upcoming" path declared after the
# "/{patient_id}" dynamic route would never be reached (it would always
# match "/{patient_id}" first, with patient_id="upcoming").
@router.get("/upcoming", response_model=UpcomingAppointmentsResponse)
async def get_upcoming_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> UpcomingAppointmentsResponse:
    """List patients by their soonest upcoming appointment, for the front-desk dashboard's default view.

    See `list_upcoming_appointments` for what "upcoming" means against
    this static seed dataset, and what the `needs_confirmation` /
    `has_unpaid_appointment` follow-up flags are actually based on.
    """
    return await list_upcoming_appointments(db, page=page, page_size=page_size)


@router.get("/{patient_id}", response_model=PatientDetailResponse)
async def get_patient(patient_id: str, db: AsyncSession = Depends(get_db)) -> PatientDetailResponse:
    """One patient's full profile plus their complete appointment history, for the Patient Detail page.

    This is the drill-down from a Patient Table row: every appointment,
    every service performed within it (with provider and time), and its
    payment if any — none of which the table view (or the analytics
    aggregates) ever surfaces per-patient.
    """
    detail = await get_patient_detail(db, patient_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return detail
