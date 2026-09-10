"""SQLAlchemy ORM model for the `payments` table.

Maps to the client's `Payment` contract in the repo-root `models.py` /
`seed_data/payment.json`. Not every appointment has a payment (some are
unpaid), and a payment's own `status` is independent of its appointment's
`status` — e.g. a confirmed appointment can have a pending or failed
payment.
"""

from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Payment(Base):
    """A payment tied to a patient, appointment, provider, and service."""

    __tablename__ = "payments"

    # Natural key from seed data ("pay_*"), not a surrogate integer PK.
    id: Mapped[str] = mapped_column(String, primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    # Integer cents, never a float — avoids floating-point rounding issues
    # in money math. Matches Service.price's convention.
    amount: Mapped[int] = mapped_column(nullable=False)
    date: Mapped[datetime] = mapped_column(nullable=False, index=True)
    method: Mapped[str] = mapped_column(String, nullable=False)
    # pending / paid / failed — independent of the related Appointment.status.
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    provider_id: Mapped[str] = mapped_column(ForeignKey("providers.id"), nullable=False)
    appointment_id: Mapped[str] = mapped_column(ForeignKey("appointments.id"), nullable=False, index=True)
    # The *primary* service being paid for on this appointment — not
    # necessarily every AppointmentService row under that appointment.
    service_id: Mapped[str] = mapped_column(ForeignKey("services.id"), nullable=False)
    created_date: Mapped[datetime] = mapped_column(nullable=False)
