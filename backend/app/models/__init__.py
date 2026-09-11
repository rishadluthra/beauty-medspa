"""SQLAlchemy ORM models package.

Re-exports every model class plus the shared `Base` so callers (e.g. Alembic
migrations, the seed loader, routers) can `from app.models import X` instead
of reaching into individual model modules.
"""

from app.models.appointment import Appointment
from app.models.appointment_service import AppointmentService
from app.models.base import Base
from app.models.custom_report import CustomReport
from app.models.patient import Patient
from app.models.payment import Payment
from app.models.provider import Provider
from app.models.service import Service

__all__ = [
    "Base",
    "Patient",
    "Provider",
    "Service",
    "Appointment",
    "AppointmentService",
    "Payment",
    "CustomReport",
]
