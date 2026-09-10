from datetime import date, datetime

from pydantic import BaseModel


class PatientListItem(BaseModel):
    id: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    phone: str
    email: str
    source: str
    created_date: datetime
    appointment_count: int
    last_appointment_date: datetime | None
    total_spent_cents: int


class PatientListResponse(BaseModel):
    items: list[PatientListItem]
    total: int
    page: int
    page_size: int
