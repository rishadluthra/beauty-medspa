"""HTTP routes for service lookups."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.services import list_services
from app.schemas.service import ServiceListResponse

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("", response_model=ServiceListResponse)
async def get_services(db: AsyncSession = Depends(get_db)) -> ServiceListResponse:
    """Every service, for populating the walk-in availability checker's service picker."""
    return await list_services(db)
