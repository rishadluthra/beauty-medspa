"""HTTP routes for patient listing.

Thin wrapper over `app.repositories.patients`: parses/validates query
params and delegates all filtering/sorting/pagination/aggregation logic to
the repository layer (see `app.repositories.__init__` for why that split
matters — the repository functions are meant to be reusable outside the
REST layer too).
"""

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
    """List patients for the Patient Table page.

    Supports free-text search (name/email/phone), exact-match filters
    (source, gender), sorting, and pagination — all applied server-side by
    `list_patients`. `page_size` is capped at 100 to keep responses bounded.
    """
    filters = PatientFilters(search=search, source=source, gender=gender)
    return await list_patients(db, filters, sort=sort, page=page, page_size=page_size)
