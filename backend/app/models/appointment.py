"""SQLAlchemy ORM model for the `appointments` table.

Maps to the client's `Appointment` contract in the repo-root `models.py` /
`seed_data/appointment.json`. An appointment belongs to one patient and has
a status, but deliberately holds no service/provider/time info itself —
that detail lives one level down in AppointmentService, since a single
appointment can bundle multiple services (e.g. consultation -> blood test
-> X-ray), each with its own provider and time window.
"""

from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Appointment(Base):
    """A patient visit; the parent of one or more AppointmentService rows."""

    __tablename__ = "appointments"

    # Natural key from seed data ("apt_*"), not a surrogate integer PK.
    id: Mapped[str] = mapped_column(String, primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    # pending / confirmed / cancelled.
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_date: Mapped[datetime] = mapped_column(nullable=False)

    # This relationship is NOT used for querying/loading data anywhere in
    # the app — it exists purely as a workaround for SQLAlchemy's async
    # unit-of-work flush ordering. Without it, when a Patient and an
    # Appointment for that patient are added to the same session and
    # flushed together (e.g. in tests via `session.add_all([...]); await
    # session.flush()`), SQLAlchemy can emit the appointment INSERT before
    # the patient INSERT, causing a ForeignKeyViolationError, because it
    # has no relationship to infer the dependency/ordering from (only a
    # bare FK column). This was verified empirically — removing it
    # reproduces the failure — after an earlier assumption that the plain
    # FK column alone would be enough turned out to be wrong. Do not
    # remove this as "unused" cleanup.
    patient: Mapped["Patient"] = relationship("Patient", foreign_keys=[patient_id])
