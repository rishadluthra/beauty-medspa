"""HTTP routes for the self-serve "Build Custom Analytics" feature.

Thin wrappers over `app.repositories.custom_reports`, same pattern as
`app.routers.analytics` -- see that module's docstring. This is the API's
first router exposing non-GET methods (see `app.main` for the matching
CORS `allow_methods` change); every other route in this app stays
read-only per the spec.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories import custom_reports as custom_reports_repo
from app.schemas.custom_reports import CustomReport, CustomReportCreate

router = APIRouter(prefix="/api/custom-reports", tags=["custom-reports"])


@router.get("", response_model=list[CustomReport])
async def list_reports(db: AsyncSession = Depends(get_db)) -> list[CustomReport]:
    """List every saved custom report, with its pivot data computed inline."""
    reports = await custom_reports_repo.list_custom_reports(db)
    return [
        CustomReport(
            id=r.id, title=r.title, metric=r.metric, dimension=r.dimension, time_grain=r.time_grain,
            created_date=r.created_date,
            data=await custom_reports_repo.get_custom_report_data(db, r.metric, r.dimension, r.time_grain),
        )
        for r in reports
    ]


@router.post("", response_model=CustomReport, status_code=201)
async def create_report(payload: CustomReportCreate, db: AsyncSession = Depends(get_db)) -> CustomReport:
    """Save a new custom report and return it with its pivot data computed inline.

    Enforces a soft cap (`custom_reports_repo.MAX_SAVED_REPORTS`) so this
    self-serve feature can't accumulate unbounded shared state -- there's
    no per-user ownership to scope deletion to, so every saved report is
    visible (and needs to stay manageable) to every viewer.
    """
    if await custom_reports_repo.count_custom_reports(db) >= custom_reports_repo.MAX_SAVED_REPORTS:
        raise HTTPException(
            status_code=400,
            detail=f"You've reached the limit of {custom_reports_repo.MAX_SAVED_REPORTS} saved reports. Delete one before creating another.",
        )
    report = await custom_reports_repo.create_custom_report(
        db, title=payload.title, metric=payload.metric, dimension=payload.dimension, time_grain=payload.time_grain
    )
    data = await custom_reports_repo.get_custom_report_data(db, report.metric, report.dimension, report.time_grain)
    return CustomReport(
        id=report.id, title=report.title, metric=report.metric, dimension=report.dimension,
        time_grain=report.time_grain, created_date=report.created_date, data=data,
    )


@router.delete("/{report_id}", status_code=204)
async def delete_report(report_id: str, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a saved custom report."""
    deleted = await custom_reports_repo.delete_custom_report(db, report_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Custom report not found.")
