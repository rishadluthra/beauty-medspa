"""Tests for the patients repository's data-access/query layer.

These exercise `list_patients` directly against the DB (bypassing the
HTTP layer -- see test_patients_router.py for that), covering the
aggregation logic (spend totals, appointment counts) and filtering.
"""

from datetime import date, datetime, timedelta

from app.repositories.patients import (
    UPCOMING_REFERENCE_OFFSET_DAYS,
    PatientFilters,
    get_patient_detail,
    list_patients,
    list_upcoming_appointments,
)
from tests.factories import (
    make_appointment,
    make_appointment_service,
    make_patient,
    make_payment,
    make_provider,
    make_service,
)


async def test_list_patients_returns_paid_total_and_appointment_count(db_session):
    """A patient's total_spent_cents only sums "paid" payments, ignoring failed/pending ones.

    Patient has one appointment and two payments (one paid, one failed);
    the failed payment must be excluded from total_spent_cents while the
    appointment is still counted once.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_1", patient_id="pat_1", amount=10000, status="paid"),
        make_payment(id="pay_2", patient_id="pat_1", amount=5000, status="failed"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters())

    assert result.total == 1
    item = result.items[0]
    assert item.appointment_count == 1
    assert item.total_spent_cents == 10000


async def test_list_patients_filters_by_source(db_session):
    """PatientFilters(source=...) restricts results to patients from that marketing channel only."""
    db_session.add_all([
        make_patient(id="pat_1", source="instagram"),
        make_patient(id="pat_2", source="google"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters(source="instagram"))

    assert result.total == 1
    assert result.items[0].id == "pat_1"


async def test_list_patients_filters_by_created_date_range(db_session):
    """created_from/created_to bound Patient.created_date, and created_to is inclusive of its whole day.

    Three patients created on Jan 5, Jan 15 (at 23:30, near end of day), and
    Jan 25. Filtering created_from=Jan 10 to created_to=Jan 15 must include
    the Jan 15 23:30 patient (proving created_to isn't just midnight) while
    excluding Jan 5 and Jan 25.
    """
    db_session.add_all([
        make_patient(id="pat_1", created_date=datetime(2026, 1, 5, 9, 0)),
        make_patient(id="pat_2", created_date=datetime(2026, 1, 15, 23, 30)),
        make_patient(id="pat_3", created_date=datetime(2026, 1, 25, 9, 0)),
    ])
    await db_session.commit()

    result = await list_patients(
        db_session, PatientFilters(created_from=datetime(2026, 1, 10).date(), created_to=datetime(2026, 1, 15).date()),
    )

    assert result.total == 1
    assert result.items[0].id == "pat_2"


async def test_list_patients_filters_by_age_range_inclusive_at_both_boundaries(db_session):
    """age_min/age_max bound age-as-of-today (derived from date_of_birth), inclusive on both ends.

    Four patients who turn exactly 19, 20, 30, and 31 today (i.e. born
    exactly that many years ago). Filtering age_min=20, age_max=30 must
    include the patients turning exactly 20 and exactly 30 today (proving
    both boundaries are inclusive, not just the range's interior) while
    excluding the ones turning 19 (too young) and 31 (too old).
    """
    today = date.today()

    def dob_n_years_ago(years: int) -> datetime:
        d = today.replace(year=today.year - years)
        return datetime(d.year, d.month, d.day)

    db_session.add_all([
        make_patient(id="pat_19", date_of_birth=dob_n_years_ago(19)),
        make_patient(id="pat_20", date_of_birth=dob_n_years_ago(20)),
        make_patient(id="pat_30", date_of_birth=dob_n_years_ago(30)),
        make_patient(id="pat_31", date_of_birth=dob_n_years_ago(31)),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters(age_min=20, age_max=30))

    assert {item.id for item in result.items} == {"pat_20", "pat_30"}


async def test_get_patient_detail_returns_none_for_unknown_id(db_session):
    """A patient id that doesn't exist returns None (the router turns this into a 404), not an error."""
    result = await get_patient_detail(db_session, "pat_does_not_exist")

    assert result is None


async def test_get_patient_detail_includes_profile_and_correct_aggregates(db_session):
    """Profile fields (including address, which the table view omits) plus the same
    aggregates as list_patients: appointment_count, total_spent_cents (paid only), last_appointment_date.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1", created_date=datetime(2026, 1, 1)),
        make_appointment(id="apt_2", patient_id="pat_1", created_date=datetime(2026, 1, 15)),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_1", patient_id="pat_1", appointment_id="apt_1", amount=15000, status="paid"),
        make_payment(id="pay_2", patient_id="pat_1", appointment_id="apt_2", amount=9999, status="failed"),
    ])
    await db_session.commit()

    result = await get_patient_detail(db_session, "pat_1")

    assert result is not None
    assert result.patient.address == "123 Main St"
    assert result.patient.appointment_count == 2
    assert result.patient.total_spent_cents == 15000  # the failed payment must not count
    assert result.patient.last_appointment_date == datetime(2026, 1, 15)


async def test_get_patient_detail_orders_appointments_most_recent_first(db_session):
    """Appointment history is ordered newest-first, regardless of insertion order."""
    db_session.add_all([
        make_patient(id="pat_1"),
        make_appointment(id="apt_old", patient_id="pat_1", created_date=datetime(2025, 6, 1)),
        make_appointment(id="apt_new", patient_id="pat_1", created_date=datetime(2026, 1, 1)),
        make_appointment(id="apt_mid", patient_id="pat_1", created_date=datetime(2025, 9, 1)),
    ])
    await db_session.commit()

    result = await get_patient_detail(db_session, "pat_1")

    assert [appointment.id for appointment in result.appointments] == ["apt_new", "apt_mid", "apt_old"]


async def test_get_patient_detail_includes_services_and_payment_per_appointment(db_session):
    """Each appointment lists every AppointmentService (with provider name + price), in start-time
    order, and carries the payment tied to it (if any) -- this is the join-entity detail that was
    previously invisible anywhere in the app.
    """
    db_session.add_all([
        make_patient(id="pat_1"),
        make_provider(id="prv_1", first_name="Dr", last_name="Smith"),
        make_provider(id="prv_2", first_name="Dr", last_name="Jones"),
        make_service(id="svc_1", name="Consultation", price=10000),
        make_service(id="svc_2", name="Blood Test", price=5000),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed", created_date=datetime(2026, 1, 1)),
        make_appointment(id="apt_2", patient_id="pat_1", status="cancelled", created_date=datetime(2026, 1, 2)),
    ])
    await db_session.flush()
    db_session.add_all([
        # Inserted out of start-time order to prove the result is sorted, not insertion-ordered.
        make_appointment_service(
            appointment_id="apt_1", service_id="svc_2", provider_id="prv_2",
            start=datetime(2026, 1, 1, 9, 30), end=datetime(2026, 1, 1, 10, 0),
        ),
        make_appointment_service(
            appointment_id="apt_1", service_id="svc_1", provider_id="prv_1",
            start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30),
        ),
        make_payment(
            id="pay_1", patient_id="pat_1", appointment_id="apt_1", service_id="svc_1",
            provider_id="prv_1", amount=15000, status="paid",
        ),
    ])
    await db_session.commit()

    result = await get_patient_detail(db_session, "pat_1")

    apt_1 = next(a for a in result.appointments if a.id == "apt_1")
    assert [s.service_name for s in apt_1.services] == ["Consultation", "Blood Test"]
    assert apt_1.services[0].provider_name == "Dr Smith"
    assert apt_1.services[0].price_cents == 10000
    assert apt_1.payment is not None
    assert apt_1.payment.amount_cents == 15000
    assert apt_1.payment.status == "paid"

    apt_2 = next(a for a in result.appointments if a.id == "apt_2")
    assert apt_2.services == []
    assert apt_2.payment is None


async def test_get_patient_detail_includes_adjacent_patient_ids_for_navigation(db_session):
    """previous_patient_id/next_patient_id are the neighbors in (last_name, first_name) order --
    the same default ordering the Patient Table sorts by -- regardless of insertion order,
    powering the Patient Detail page's Previous/Next buttons.
    """
    db_session.add_all([
        make_patient(id="pat_carter", first_name="Carol", last_name="Carter"),
        make_patient(id="pat_anderson", first_name="Alice", last_name="Anderson"),
        make_patient(id="pat_baker", first_name="Bob", last_name="Baker"),
    ])
    await db_session.commit()

    middle = await get_patient_detail(db_session, "pat_baker")
    assert middle.previous_patient_id == "pat_anderson"
    assert middle.next_patient_id == "pat_carter"

    first = await get_patient_detail(db_session, "pat_anderson")
    assert first.previous_patient_id is None
    assert first.next_patient_id == "pat_baker"

    last = await get_patient_detail(db_session, "pat_carter")
    assert last.previous_patient_id == "pat_baker"
    assert last.next_patient_id is None


async def test_list_upcoming_appointments_computes_reference_date_and_follow_up_flags(db_session):
    """Covers the whole Upcoming Appointments contract in one seeded scenario:

    - `reference_date` is derived from the latest AppointmentService.start in the data
      (max_start - UPCOMING_REFERENCE_OFFSET_DAYS), not the real wall-clock date.
    - Each patient shows their *soonest* upcoming (non-cancelled, >= reference_now)
      appointment, even when they have more than one qualifying appointment (pat_a).
    - `needs_confirmation` is true only for a "pending" appointment landing on the
      reference date itself (pat_b) -- including one scheduled *earlier* in that day
      than `reference_now`'s own arbitrary time-of-day component (10:00 here), since
      the upcoming/past boundary is the start of the reference day, not that exact
      timestamp.
    - `has_unpaid_appointment` is true only for a *non-cancelled* past appointment with
      no Payment row (pat_a); a cancelled past appointment with no payment (pat_c)
      must NOT trigger it.
    - A patient with no upcoming appointment at all (pat_d) doesn't appear.
    """
    max_start = datetime(2026, 2, 1, 10, 0)
    reference_now = max_start - timedelta(days=UPCOMING_REFERENCE_OFFSET_DAYS)

    db_session.add_all([
        make_patient(id="pat_a", first_name="Alice", last_name="Anderson"),
        make_patient(id="pat_b", first_name="Bob", last_name="Baker"),
        make_patient(id="pat_c", first_name="Carol", last_name="Carter"),
        make_patient(id="pat_d", first_name="Dana", last_name="Dean"),
        make_provider(), make_service(),
        make_appointment(id="apt_a_past", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_a_upcoming", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_a_max", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_b_upcoming", patient_id="pat_b", status="pending"),
        make_appointment(id="apt_c_past_cancelled", patient_id="pat_c", status="cancelled"),
        make_appointment(id="apt_c_upcoming", patient_id="pat_c", status="confirmed"),
        make_appointment(id="apt_d_past", patient_id="pat_d", status="confirmed"),
    ])
    await db_session.flush()

    def _svc(appointment_id, start):
        return make_appointment_service(appointment_id=appointment_id, start=start, end=start + timedelta(minutes=30))

    db_session.add_all([
        _svc("apt_a_past", reference_now - timedelta(days=30)),
        _svc("apt_a_upcoming", reference_now + timedelta(days=2)),
        _svc("apt_a_max", max_start),  # the row that actually sets max_start
        # 08:00, deliberately *before* reference_now's own 10:00 time-of-day
        # component, to prove the cutoff is the start of the day, not that
        # exact timestamp.
        _svc("apt_b_upcoming", reference_now.replace(hour=8, minute=0)),
        _svc("apt_c_past_cancelled", reference_now - timedelta(days=10)),
        _svc("apt_c_upcoming", reference_now + timedelta(days=5)),
        _svc("apt_d_past", reference_now - timedelta(days=5)),
        # Deliberately no Payment rows for any appointment -- pat_a's and
        # pat_c's past appointments are both unpaid; only pat_a's should count
        # since pat_c's is cancelled.
    ])
    await db_session.commit()

    result = await list_upcoming_appointments(db_session)

    assert result.reference_date == reference_now.date()

    by_id = {item.id: item for item in result.items}
    assert "pat_d" not in by_id

    assert by_id["pat_a"].upcoming_appointment_date == reference_now + timedelta(days=2)
    assert by_id["pat_a"].has_unpaid_appointment is True
    assert by_id["pat_a"].needs_confirmation is False

    assert by_id["pat_b"].needs_confirmation is True
    assert by_id["pat_b"].has_unpaid_appointment is False

    assert by_id["pat_c"].has_unpaid_appointment is False
    assert by_id["pat_c"].needs_confirmation is False
