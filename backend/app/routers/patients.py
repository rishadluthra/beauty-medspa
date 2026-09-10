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
