"""HTTP routes for provider lookups."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories.providers import list_providers
from app.schemas.provider import ProviderListResponse

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("", response_model=ProviderListResponse)
async def get_providers(db: AsyncSession = Depends(get_db)) -> ProviderListResponse:
    """Every provider, for populating the schedule views' provider filter."""
    return await list_providers(db)
