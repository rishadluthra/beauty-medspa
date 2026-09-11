"""Shared object-construction helpers for tests.

Each `make_*` function builds a fully-valid ORM model instance with
sensible, arbitrary-but-consistent defaults (matching seed-data ID
prefixes like `pat_`/`prv_`/`svc_`/`apt_`/`pay_`), reused across the
repository and router tests. Tests only pass the specific fields they
care about for the scenario under test (e.g. `status="cancelled"`) and
let everything else fall back to the default -- keeping test setup
short and making it obvious which field is actually relevant to each
assertion.
"""

from datetime import datetime

from app.models import Appointment, AppointmentService, Patient, Payment, Provider, Service


def make_patient(id="pat_1", first_name="Jane", last_name="Doe", source="website", gender="female",
                  created_date=None, date_of_birth=None):
    """Build a Patient with default demographics; override id/name/source/gender/dates as needed."""
    return Patient(
        id=id, first_name=first_name, last_name=last_name,
        date_of_birth=date_of_birth or datetime(1990, 1, 1), gender=gender,
        address="123 Main St", phone="555-0100", email=f"{id}@example.com",
        source=source, created_date=created_date or datetime.utcnow(),
    )


def make_provider(id="prv_1", first_name="Dr", last_name="Smith"):
    """Build a Provider (staff member) with default name."""
    return Provider(
        id=id, first_name=first_name, last_name=last_name,
        email=f"{id}@example.com", phone="555-0000", created_date=datetime.utcnow(),
    )


def make_service(id="svc_1", name="Consultation", price=10000, duration=30):
    """Build a billable Service; price is in cents, duration in minutes."""
    return Service(
        id=id, name=name, description=f"{name} description",
        price=price, duration=duration, created_date=datetime.utcnow(),
    )


def make_appointment(id="apt_1", patient_id="pat_1", status="confirmed", created_date=None):
    """Build an Appointment shell (no service/provider/time -- see make_appointment_service)."""
    return Appointment(
        id=id, patient_id=patient_id, status=status,
        created_date=created_date or datetime.utcnow(),
    )


def make_appointment_service(appointment_id="apt_1", service_id="svc_1", provider_id="prv_1", start=None, end=None):
    """Build one appointment/service/provider booking (the join-entity row).

    Call this more than once with the same appointment_id to simulate an
    appointment that bundles multiple bookings (e.g. consultation + X-ray).
    """
    return AppointmentService(
        appointment_id=appointment_id, service_id=service_id, provider_id=provider_id,
        start=start or datetime(2026, 1, 1, 9, 0),
        end=end or datetime(2026, 1, 1, 9, 30),
    )


def make_payment(id="pay_1", patient_id="pat_1", amount=10000, status="paid",
                  provider_id="prv_1", appointment_id="apt_1", service_id="svc_1", date=None):
    """Build a Payment; amount is in cents, status defaults to "paid"."""
    resolved_date = date or datetime.utcnow()
    return Payment(
        id=id, patient_id=patient_id, amount=amount, date=resolved_date,
        method="credit_card", status=status, provider_id=provider_id,
        appointment_id=appointment_id, service_id=service_id, created_date=resolved_date,
    )
