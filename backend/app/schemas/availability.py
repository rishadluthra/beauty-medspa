"""Response schemas for the walk-in availability checker."""

from datetime import datetime

from pydantic import BaseModel


class ProviderAvailability(BaseModel):
    """One provider's availability for the requested service at the requested moment."""

    provider_id: str
    provider_name: str
    available: bool
    # Only set when `available` is False -- when the provider is next free,
    # per their existing (non-cancelled) bookings that overlap the requested window.
    busy_until: datetime | None


class AvailabilityResponse(BaseModel):
    """The walk-in availability check's result: every provider, available-first."""

    service_id: str
    service_name: str
    service_duration_minutes: int
    # The requested moment this was checked against (defaults to "right now"
    # against this dataset -- see `get_default_availability_check_time`).
    at: datetime
    providers: list[ProviderAvailability]
