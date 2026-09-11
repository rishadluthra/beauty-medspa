"""Response schemas for service lookups (e.g. populating the walk-in availability checker)."""

from pydantic import BaseModel


class ServiceListItem(BaseModel):
    id: str
    name: str
    duration: int  # minutes
    price_cents: int


class ServiceListResponse(BaseModel):
    items: list[ServiceListItem]
