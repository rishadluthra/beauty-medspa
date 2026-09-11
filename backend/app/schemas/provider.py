"""Response schemas for provider lookups (e.g. populating a provider filter)."""

from pydantic import BaseModel


class ProviderListItem(BaseModel):
    id: str
    first_name: str
    last_name: str


class ProviderListResponse(BaseModel):
    items: list[ProviderListItem]
