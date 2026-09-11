"""Tests for the patients repository's data-access/query layer.

These exercise `list_patients` directly against the DB (bypassing the
HTTP layer -- see test_patients_router.py for that), covering the
aggregation logic (spend totals, appointment counts) and filtering.
"""

from datetime import date, datetime, timedelta

from app.repositories.patients import (
    PatientFilters,
    PatientListContext,
    get_calendar_month,
    get_patient_detail,
    list_rebooking_opportunities,
    list_patients,
    list_schedule_for_date,
    list_todays_appointments,
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


async def test_list_patients_last_appointment_date_is_the_actual_visit_time_not_created_date(db_session):
    """last_appointment_date comes from AppointmentService.start (the real scheduled visit
    time), not Appointment.created_date. created_date is set here to the opposite order of
    the real appointment times, so this fails if the aggregate ever regresses to created_date.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1", created_date=datetime(2026, 1, 1)),
        make_appointment(id="apt_2", patient_id="pat_1", created_date=datetime(2025, 1, 1)),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_1", start=datetime(2025, 3, 1, 9, 0), end=datetime(2025, 3, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_2", start=datetime(2025, 11, 1, 9, 0), end=datetime(2025, 11, 1, 9, 30)),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters())

    assert result.items[0].last_appointment_date == datetime(2025, 11, 1, 9, 0)


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

    last_appointment_date must come from AppointmentService.start (the actual scheduled
    visit time), not Appointment.created_date -- created_date is set here to be
    deliberately unrelated to (and in the opposite order of) the real appointment times,
    to prove the aggregate isn't accidentally reading the wrong column.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1", created_date=datetime(2026, 1, 15)),
        make_appointment(id="apt_2", patient_id="pat_1", created_date=datetime(2026, 1, 1)),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_1", start=datetime(2025, 3, 1, 9, 0), end=datetime(2025, 3, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_2", start=datetime(2025, 9, 1, 9, 0), end=datetime(2025, 9, 1, 9, 30)),
        make_payment(id="pay_1", patient_id="pat_1", appointment_id="apt_1", amount=15000, status="paid"),
        make_payment(id="pay_2", patient_id="pat_1", appointment_id="apt_2", amount=9999, status="failed"),
    ])
    await db_session.commit()

    result = await get_patient_detail(db_session, "pat_1")

    assert result is not None
    assert result.patient.address == "123 Main St"
    assert result.patient.appointment_count == 2
    assert result.patient.total_spent_cents == 15000  # the failed payment must not count
    assert result.patient.last_appointment_date == datetime(2025, 9, 1, 9, 0)  # apt_2's service start, the later real visit


async def test_get_patient_detail_orders_appointments_by_actual_visit_date_not_created_date(db_session):
    """Appointment history is ordered by each appointment's actual scheduled visit date
    (its earliest AppointmentService.start), most recent first -- NOT by created_date.

    created_date is deliberately set in the *opposite* order from the real appointment
    times below, so this test would fail if the sort ever regresses back to created_date.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_old", patient_id="pat_1", created_date=datetime(2026, 1, 1)),
        make_appointment(id="apt_new", patient_id="pat_1", created_date=datetime(2025, 6, 1)),
        make_appointment(id="apt_mid", patient_id="pat_1", created_date=datetime(2025, 9, 1)),
        make_appointment(id="apt_unscheduled", patient_id="pat_1", created_date=datetime(2025, 1, 1)),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_old", start=datetime(2025, 1, 1, 9, 0), end=datetime(2025, 1, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_new", start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_mid", start=datetime(2025, 9, 1, 9, 0), end=datetime(2025, 9, 1, 9, 30)),
        # apt_unscheduled has no AppointmentService rows at all -- nothing to sort it by
        # chronologically, so it must sort last rather than crowding out real dates.
    ])
    await db_session.commit()

    result = await get_patient_detail(db_session, "pat_1")

    assert [appointment.id for appointment in result.appointments] == ["apt_new", "apt_mid", "apt_old", "apt_unscheduled"]
    assert result.appointments[0].appointment_date == datetime(2026, 1, 1, 9, 0)
    assert result.appointments[-1].appointment_date is None


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


async def test_get_patient_detail_all_context_scopes_previous_next_to_active_sort_and_filters(db_session):
    """`context=PatientListContext(kind="all", filters=..., sort=...)` walks Previous/Next
    in whatever filter+sort the Patient Table is currently using -- not always its default
    unfiltered, name-sorted order.

    Four patients, three "instagram"-sourced with different total spend and one
    "google"-sourced. Sorting by total_spent (descending) within source="instagram" gives
    an order (pat_a $300 > pat_c $200 > pat_b $100) that is neither alphabetical
    (last names are Zeta/Middle/Alpha) nor insertion order, and excludes the google
    patient entirely -- so a correct result here proves the filter+sort are genuinely
    being applied, not silently defaulted.
    """
    db_session.add_all([
        make_patient(id="pat_a", first_name="Zed", last_name="Zeta", source="instagram"),
        make_patient(id="pat_b", first_name="Amy", last_name="Alpha", source="instagram"),
        make_patient(id="pat_c", first_name="Mia", last_name="Middle", source="instagram"),
        make_patient(id="pat_other_source", first_name="Ann", last_name="Aardvark", source="google"),
        make_provider(), make_service(),
        make_appointment(id="apt_a", patient_id="pat_a"),
        make_appointment(id="apt_b", patient_id="pat_b"),
        make_appointment(id="apt_c", patient_id="pat_c"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_payment(id="pay_a", patient_id="pat_a", appointment_id="apt_a", amount=30000, status="paid"),
        make_payment(id="pay_b", patient_id="pat_b", appointment_id="apt_b", amount=10000, status="paid"),
        make_payment(id="pay_c", patient_id="pat_c", appointment_id="apt_c", amount=20000, status="paid"),
    ])
    await db_session.commit()

    context = PatientListContext(kind="all", filters=PatientFilters(source="instagram"), sort="total_spent")

    middle = await get_patient_detail(db_session, "pat_c", context=context)
    assert middle.previous_patient_id == "pat_a"
    assert middle.next_patient_id == "pat_b"

    top = await get_patient_detail(db_session, "pat_a", context=context)
    assert top.previous_patient_id is None
    assert top.next_patient_id == "pat_c"

    # Same patient, no context (or the default "all"/unfiltered/name-sorted context) --
    # falls back to the old fixed global order instead, proving the two don't bleed into
    # each other. Global order is (last_name, first_name): Alpha, Middle, Zeta, so pat_a
    # ("Zeta") has no next and its previous is pat_c ("Middle") -- the opposite of the
    # total_spent-sorted result above.
    global_order = await get_patient_detail(db_session, "pat_a")
    assert global_order.previous_patient_id == "pat_c"
    assert global_order.next_patient_id is None


async def test_get_patient_detail_today_context_scopes_previous_next_to_todays_schedule_order(db_session):
    """`context=PatientListContext(kind="today", service_id=..., provider_id=...)` walks
    Previous/Next in the same chronological schedule order (optionally narrowed to one
    provider) `list_todays_appointments` displays -- not the global name-sorted order.

    `service_id` (not just the patient id) pins down which specific row on the schedule
    the agent actually clicked, since a patient can have more than one service today.
    """
    db_session.add_all([
        make_patient(id="pat_a", first_name="Alice", last_name="Zeta"),
        make_patient(id="pat_b", first_name="Bob", last_name="Yankee"),
        make_patient(id="pat_c", first_name="Carol", last_name="Xray"),
        make_provider(id="prv_1", first_name="Dr", last_name="Smith"),
        make_provider(id="prv_2", first_name="Dr", last_name="Jones"),
        make_service(),
        make_appointment(id="apt_a", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_a_later", patient_id="pat_a", status="confirmed"),  # sets the latest data month
        make_appointment(id="apt_b", patient_id="pat_b", status="confirmed"),
        make_appointment(id="apt_c", patient_id="pat_c", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_a", provider_id="prv_1", start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_a_later", provider_id="prv_1", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
        make_appointment_service(appointment_id="apt_b", provider_id="prv_2", start=datetime(2026, 1, 1, 11, 0), end=datetime(2026, 1, 1, 11, 30)),
        make_appointment_service(appointment_id="apt_c", provider_id="prv_1", start=datetime(2026, 1, 1, 14, 0), end=datetime(2026, 1, 1, 14, 30)),
    ])
    await db_session.commit()

    # Names are deliberately reverse-alphabetical (Alice Zeta ... Carol Xray) so a correct
    # chronological result here proves the global name-sorted fallback isn't being used.
    schedule = await list_todays_appointments(db_session)
    middle_service_id = next(item.id for item in schedule.items if item.patient_id == "pat_b")

    detail = await get_patient_detail(
        db_session, "pat_b", context=PatientListContext(kind="today", service_id=middle_service_id),
    )
    assert detail.previous_patient_id == "pat_a"
    assert detail.next_patient_id == "pat_c"

    # previous_service_id/next_service_id must be the NEIGHBORING rows' own ids (pat_a's
    # and pat_c's actual AppointmentService rows), not middle_service_id echoed back --
    # the frontend uses these to advance its anchor on the next hop. Regression guard for
    # a real bug: reusing the *same* service_id across hops re-ranks every subsequent
    # request against the original row forever, so a second "Next" click resolves back to
    # the page already on screen and silently does nothing (reported as "Next gets stuck
    # after one click").
    a_service_id = next(item.id for item in schedule.items if item.patient_id == "pat_a")
    c_service_id = next(item.id for item in schedule.items if item.patient_id == "pat_c")
    assert detail.previous_service_id == a_service_id
    assert detail.next_service_id == c_service_id

    # Simulating the actual second hop a click-through does: land on pat_c using the
    # service_id the FIRST response returned (c_service_id), not the original
    # middle_service_id. This must advance further (no next patient after pat_c), not
    # loop back to pat_b.
    detail_c = await get_patient_detail(
        db_session, "pat_c", context=PatientListContext(kind="today", service_id=detail.next_service_id),
    )
    assert detail_c.previous_patient_id == "pat_b"
    assert detail_c.next_patient_id is None

    # Narrowing to Dr Smith's (prv_1) own schedule removes pat_b (Dr Jones's patient) from
    # the ranking entirely, so pat_a's and pat_c's own Dr Smith slots become each other's
    # direct neighbors.
    prv1_schedule = await list_todays_appointments(db_session, provider_id="prv_1")
    a_service_id = next(item.id for item in prv1_schedule.items if item.patient_id == "pat_a")
    detail_a = await get_patient_detail(
        db_session, "pat_a",
        context=PatientListContext(kind="today", service_id=a_service_id, provider_id="prv_1"),
    )
    assert detail_a.previous_patient_id is None
    assert detail_a.next_patient_id == "pat_c"


async def test_get_patient_detail_rebooking_context_scopes_previous_next_to_rebooking_order(db_session):
    """`context=PatientListContext(kind="rebooking")` walks Previous/Next in the same
    most-recent-visit-first order `list_rebooking_opportunities` displays -- not the
    global name-sorted order.
    """
    db_session.add_all([
        make_patient(id="pat_a", first_name="Zed", last_name="Zeta"),    # most recent visit
        make_patient(id="pat_g", first_name="Gale", last_name="Gamma"),  # middle
        make_patient(id="pat_b", first_name="Amy", last_name="Alpha"),   # oldest visit
        make_patient(id="pat_d", first_name="Dana", last_name="Dean"),   # sets the latest data months
        make_provider(), make_service(),
        make_appointment(id="apt_a", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_g", patient_id="pat_g", status="confirmed"),
        make_appointment(id="apt_b", patient_id="pat_b", status="confirmed"),
        # A different patient's appointments in TWO further-out months (Jan and Feb 2026)
        # anchor the reference date to Jan 2026 (the second-to-last of three distinct
        # months: Nov 2025, Jan 2026, Feb 2026) -- see the identical reasoning in
        # test_list_rebooking_opportunities_last_service_and_provider_come_from_the_latest_row_specifically
        # for why a single further-out month (making reference land in Nov/Dec 2025
        # itself) would risk flagging one of pat_a/pat_g/pat_b as having an "upcoming"
        # appointment via the has_upcoming anti-join.
        make_appointment(id="apt_month_jan", patient_id="pat_d", status="confirmed"),
        make_appointment(id="apt_month_feb", patient_id="pat_d", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_a", start=datetime(2025, 11, 20, 9, 0), end=datetime(2025, 11, 20, 9, 30)),
        make_appointment_service(appointment_id="apt_g", start=datetime(2025, 11, 10, 9, 0), end=datetime(2025, 11, 10, 9, 30)),
        make_appointment_service(appointment_id="apt_b", start=datetime(2025, 11, 1, 9, 0), end=datetime(2025, 11, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_month_jan", start=datetime(2026, 1, 5, 10, 0), end=datetime(2026, 1, 5, 10, 30)),
        make_appointment_service(appointment_id="apt_month_feb", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
    ])
    await db_session.commit()

    # Names are deliberately NOT in visit-recency order (pat_a="Zed Zeta" would sort last
    # alphabetically despite having the most recent visit), so a correct rebooking-order
    # result here proves it isn't silently falling back to the global name-sorted order.
    detail = await get_patient_detail(db_session, "pat_g", context=PatientListContext(kind="rebooking"))
    assert detail.previous_patient_id == "pat_a"  # more recent visit (Nov 20) sorts before
    assert detail.next_patient_id == "pat_b"  # older visit (Nov 1) sorts after

    first = await get_patient_detail(db_session, "pat_a", context=PatientListContext(kind="rebooking"))
    assert first.previous_patient_id is None
    assert first.next_patient_id == "pat_g"


async def test_list_upcoming_appointments_anchors_to_first_of_second_to_last_data_month(db_session):
    """reference_date is the 1st of the second-to-last *distinct calendar month that has
    any scheduled appointment* -- not literally "one month back" regardless of whether
    that month has data. With appointments in Nov 2025, Dec 2025, and Feb 2026 (no
    January at all), the two latest months-with-data are Feb and Dec, so reference_date
    is 2025-12-01 -- December, not the empty January in between.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_2", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_3", patient_id="pat_1", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_1", start=datetime(2025, 11, 1, 9, 0), end=datetime(2025, 11, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_2", start=datetime(2025, 12, 15, 9, 0), end=datetime(2025, 12, 15, 9, 30)),
        make_appointment_service(appointment_id="apt_3", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
    ])
    await db_session.commit()

    result = await list_upcoming_appointments(db_session)

    assert result.reference_date == date(2025, 12, 1)


async def test_list_upcoming_appointments_selects_soonest_and_excludes_cancelled_past_and_today(db_session):
    """Covers the rest of the Upcoming Appointments contract in one seeded scenario, all
    anchored to reference_date = 2026-01-01 (set by the Feb 2026 appointment below):

    - Each patient shows their *soonest* upcoming (non-cancelled, strictly after reference
      date) appointment, even when they have more than one qualifying one (pat_a).
    - A same-day appointment right on the reference date does NOT count as "upcoming"
      (pat_b) -- today is covered by list_todays_appointments instead, so the two views
      must not double-show the same appointment.
    - A patient whose only after-reference appointment is cancelled (pat_c) doesn't
      appear at all -- a cancelled booking isn't a real upcoming visit.
    - A patient with only appointments before the reference date (pat_d) doesn't appear.
    """
    db_session.add_all([
        make_patient(id="pat_a", first_name="Alice", last_name="Anderson"),
        make_patient(id="pat_b", first_name="Bob", last_name="Baker"),
        make_patient(id="pat_c", first_name="Carol", last_name="Carter"),
        make_patient(id="pat_d", first_name="Dana", last_name="Dean"),
        make_provider(), make_service(),
        make_appointment(id="apt_a_soon", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_a_later", patient_id="pat_a", status="confirmed"),  # also sets the latest data month
        make_appointment(id="apt_b_today", patient_id="pat_b", status="pending"),
        make_appointment(id="apt_c_cancelled", patient_id="pat_c", status="cancelled"),
        make_appointment(id="apt_d_past", patient_id="pat_d", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_a_soon", start=datetime(2026, 1, 15, 9, 0), end=datetime(2026, 1, 15, 9, 30)),
        make_appointment_service(appointment_id="apt_a_later", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
        make_appointment_service(appointment_id="apt_b_today", start=datetime(2026, 1, 1, 0, 30), end=datetime(2026, 1, 1, 1, 0)),
        make_appointment_service(appointment_id="apt_c_cancelled", start=datetime(2026, 1, 10, 9, 0), end=datetime(2026, 1, 10, 9, 30)),
        make_appointment_service(appointment_id="apt_d_past", start=datetime(2025, 11, 1, 9, 0), end=datetime(2025, 11, 1, 9, 30)),
    ])
    await db_session.commit()

    result = await list_upcoming_appointments(db_session)

    assert result.reference_date == date(2026, 1, 1)

    by_id = {item.id: item for item in result.items}
    assert by_id["pat_a"].upcoming_appointment_date == datetime(2026, 1, 15, 9, 0)
    assert "pat_b" not in by_id  # today, not upcoming
    assert "pat_c" not in by_id
    assert "pat_d" not in by_id


async def test_list_todays_appointments_one_row_per_service_excludes_cancelled_and_other_days(db_session):
    """Covers the Today's Appointments contract, anchored to reference_date = 2026-01-01
    (set by the Feb 2026 appointment below):

    - One row per AppointmentService scheduled on the reference date itself, not one row
      per Appointment -- a multi-service appointment (pat_a's) produces two rows, one per
      service, each with its own time and provider.
    - A cancelled appointment scheduled today (pat_b's) is excluded entirely.
    - Appointments on other days (before or after today) don't appear (pat_c's, and the
      Feb appointment used only to set the latest data month).
    - Rows are sorted by start time.
    """
    db_session.add_all([
        make_patient(id="pat_a", first_name="Alice", last_name="Anderson"),
        make_patient(id="pat_b", first_name="Bob", last_name="Baker"),
        make_patient(id="pat_c", first_name="Carol", last_name="Carter"),
        make_provider(id="prv_1", first_name="Dr", last_name="Smith"),
        make_provider(id="prv_2", first_name="Dr", last_name="Jones"),
        make_service(id="svc_1", name="Consultation"),
        make_service(id="svc_2", name="Facial"),
        make_appointment(id="apt_a_today", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_a_later", patient_id="pat_a", status="confirmed"),  # sets the latest data month
        make_appointment(id="apt_b_cancelled_today", patient_id="pat_b", status="cancelled"),
        make_appointment(id="apt_c_tomorrow", patient_id="pat_c", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(
            appointment_id="apt_a_today", service_id="svc_2", provider_id="prv_2",
            start=datetime(2026, 1, 1, 14, 0), end=datetime(2026, 1, 1, 14, 30),
        ),
        make_appointment_service(
            appointment_id="apt_a_today", service_id="svc_1", provider_id="prv_1",
            start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30),
        ),
        make_appointment_service(appointment_id="apt_a_later", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
        make_appointment_service(appointment_id="apt_b_cancelled_today", start=datetime(2026, 1, 1, 11, 0), end=datetime(2026, 1, 1, 11, 30)),
        make_appointment_service(appointment_id="apt_c_tomorrow", start=datetime(2026, 1, 2, 9, 0), end=datetime(2026, 1, 2, 9, 30)),
    ])
    await db_session.commit()

    result = await list_todays_appointments(db_session)

    assert result.reference_date == date(2026, 1, 1)
    assert [item.service_name for item in result.items] == ["Consultation", "Facial"]  # sorted by start time
    assert result.items[0].provider_name == "Dr Smith"
    assert result.items[0].patient_name == "Alice Anderson"
    assert {item.patient_id for item in result.items} == {"pat_a"}  # pat_b (cancelled) and pat_c (tomorrow) excluded

    # provider_id narrows the schedule to just that provider's own services today --
    # Dr Jones (prv_2) only has the Facial service, not Dr Smith's (prv_1) Consultation.
    filtered = await list_todays_appointments(db_session, provider_id="prv_2")
    assert [item.service_name for item in filtered.items] == ["Facial"]


async def test_list_upcoming_appointments_filters_by_provider_using_that_providers_own_soonest_slot(db_session):
    """provider_id filters to that provider's own upcoming services, and "soonest" is
    computed against just that provider's slots -- not the appointment's overall soonest
    slot, which could belong to a different provider.

    pat_a's single appointment has two services: an earlier one with Dr Smith (prv_1) and
    a later one with Dr Jones (prv_2). Filtering for Dr Jones must report the LATER time as
    pat_a's "soonest with Dr Jones", not the earlier Dr Smith slot. pat_b has no service with
    Dr Jones at all and must not appear in the Dr Jones-filtered results.
    """
    db_session.add_all([
        make_patient(id="pat_a", first_name="Alice", last_name="Anderson"),
        make_patient(id="pat_b", first_name="Bob", last_name="Baker"),
        make_provider(id="prv_1", first_name="Dr", last_name="Smith"),
        make_provider(id="prv_2", first_name="Dr", last_name="Jones"),
        make_service(),
        make_appointment(id="apt_a", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_a_later", patient_id="pat_a", status="confirmed"),  # sets the latest data month
        make_appointment(id="apt_b", patient_id="pat_b", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(
            appointment_id="apt_a", provider_id="prv_1",
            start=datetime(2026, 1, 10, 9, 0), end=datetime(2026, 1, 10, 9, 30),
        ),
        make_appointment_service(
            appointment_id="apt_a", provider_id="prv_2",
            start=datetime(2026, 1, 15, 9, 0), end=datetime(2026, 1, 15, 9, 30),
        ),
        make_appointment_service(appointment_id="apt_a_later", provider_id="prv_1", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
        make_appointment_service(appointment_id="apt_b", provider_id="prv_1", start=datetime(2026, 1, 12, 9, 0), end=datetime(2026, 1, 12, 9, 30)),
    ])
    await db_session.commit()

    result = await list_upcoming_appointments(db_session, provider_id="prv_2")

    by_id = {item.id: item for item in result.items}
    assert by_id["pat_a"].upcoming_appointment_date == datetime(2026, 1, 15, 9, 0)  # Dr Jones's slot, not Dr Smith's earlier one
    assert "pat_b" not in by_id  # has no service with Dr Jones


async def test_list_schedule_for_date_returns_the_given_days_schedule_not_the_reference_day(db_session):
    """`list_schedule_for_date` must respect the caller's own `target_date`, not silently
    fall back to the dataset's reference "today" -- this is what the Calendar view's
    day-drill-down depends on to show a day other than today's own schedule.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_target_day", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_other_day", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_later", patient_id="pat_1", status="confirmed"),  # sets the latest data month
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_target_day", start=datetime(2026, 1, 15, 9, 0), end=datetime(2026, 1, 15, 9, 30)),
        make_appointment_service(appointment_id="apt_other_day", start=datetime(2026, 1, 16, 9, 0), end=datetime(2026, 1, 16, 9, 30)),
        make_appointment_service(appointment_id="apt_later", start=datetime(2026, 3, 1, 10, 0), end=datetime(2026, 3, 1, 10, 30)),
    ])
    await db_session.commit()

    result = await list_schedule_for_date(db_session, date(2026, 1, 15))

    assert len(result.items) == 1
    assert result.items[0].start == datetime(2026, 1, 15, 9, 0)
    assert result.reference_date == date(2026, 1, 15)  # echoes the requested day, not the dataset's reference "today"


async def test_get_calendar_month_returns_every_day_with_correct_counts(db_session):
    """Covers the Calendar view's density grid:

    - Every day of the requested month appears, including zero-count days (Jan 2 below).
    - Counts are per-`AppointmentService`, so a multi-service day (Jan 1, two services)
      counts 2, not 1.
    - A cancelled appointment on Jan 3 doesn't contribute to that day's count.
    - Days outside the requested month (Feb 1) are excluded entirely.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(id="prv_1"), make_provider(id="prv_2"),
        make_service(),
        make_appointment(id="apt_jan1", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_jan3_cancelled", patient_id="pat_1", status="cancelled"),
        make_appointment(id="apt_feb1", patient_id="pat_1", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_jan1", provider_id="prv_1", start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_jan1", provider_id="prv_2", start=datetime(2026, 1, 1, 10, 0), end=datetime(2026, 1, 1, 10, 30)),
        make_appointment_service(appointment_id="apt_jan3_cancelled", start=datetime(2026, 1, 3, 9, 0), end=datetime(2026, 1, 3, 9, 30)),
        make_appointment_service(appointment_id="apt_feb1", start=datetime(2026, 2, 1, 9, 0), end=datetime(2026, 2, 1, 9, 30)),
    ])
    await db_session.commit()

    result = await get_calendar_month(db_session, year=2026, month=1)

    assert result.month == "2026-01"
    assert len(result.days) == 31  # every day of January, regardless of data
    counts_by_date = {day.date: day.count for day in result.days}
    assert counts_by_date[date(2026, 1, 1)] == 2  # two services that day
    assert counts_by_date[date(2026, 1, 2)] == 0  # no data at all -- still present in the grid
    assert counts_by_date[date(2026, 1, 3)] == 0  # cancelled appointment doesn't count
    assert date(2026, 2, 1) not in counts_by_date  # outside the requested month


async def test_get_calendar_month_defaults_to_the_reference_months(db_session):
    """Omitting year/month must default to the dataset's reference "today" own month --
    not the real current calendar month, which would be empty against this frozen dataset.
    """
    db_session.add_all([
        make_patient(id="pat_1"), make_provider(), make_service(),
        make_appointment(id="apt_1", patient_id="pat_1", status="confirmed"),
        make_appointment(id="apt_2", patient_id="pat_1", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_1", start=datetime(2025, 12, 10, 9, 0), end=datetime(2025, 12, 10, 9, 30)),
        make_appointment_service(appointment_id="apt_2", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),  # sets reference month to Dec 2025
    ])
    await db_session.commit()

    result = await get_calendar_month(db_session)

    assert result.month == "2025-12"
    assert result.reference_date == date(2025, 12, 1)


async def test_list_patients_search_matches_name_anywhere_case_insensitively(db_session):
    """Name search is a genuine substring match, case-insensitively, across "first last" --
    covers matching within the last name, within the first name, and across the space
    joining them.
    """
    db_session.add_all([
        make_patient(id="pat_1", first_name="Julia", last_name="Acevedo"),
        make_patient(id="pat_2", first_name="Adam", last_name="Morton"),
    ])
    await db_session.commit()

    by_last_name = await list_patients(db_session, PatientFilters(search="ACEVEDO"))
    assert [item.id for item in by_last_name.items] == ["pat_1"]

    by_first_name = await list_patients(db_session, PatientFilters(search="jul"))
    assert [item.id for item in by_first_name.items] == ["pat_1"]

    across_the_space = await list_patients(db_session, PatientFilters(search="lia acev"))
    assert [item.id for item in across_the_space.items] == ["pat_1"]


async def test_list_patients_search_does_not_match_an_unrelated_patients_email_midstring(db_session):
    """Regression test for a real reported bug: searching a patient's actual last name
    ("Acevedo") also returned a completely unrelated patient ("Adam Morton") purely because
    his randomly generated seed-data email happened to contain "acevedo" in the middle
    ("jermaineacevedo@example.org"). Covered twice over now: "acevedo" contains no "@", so
    email isn't searched at all, and even if it were, it wouldn't match from the start.
    """
    db_session.add_all([
        make_patient(id="pat_1", first_name="Julia", last_name="Acevedo", email="angela30@example.com"),
        make_patient(id="pat_2", first_name="Adam", last_name="Morton", email="jermaineacevedo@example.org"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters(search="acevedo"))

    assert [item.id for item in result.items] == ["pat_1"]  # NOT pat_2, despite the email substring


async def test_list_patients_search_does_not_match_the_shared_email_domain(db_session):
    """Regression test for the same root cause at its most extreme: every seed patient's
    email shares a domain fragment ("example.com"/"example.org"/"example.net"), so an
    unanchored substring match against email would make searching "example" return every
    patient in the database -- confirmed live against the real dataset (4,000 of 4,000
    patients) before this fix. Anchoring email matching to the start of the address means
    a domain-only fragment like this can never match anyone.
    """
    db_session.add_all([
        make_patient(id="pat_1", email="angela30@example.com"),
        make_patient(id="pat_2", email="jermaine@example.org"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters(search="example"))

    assert result.total == 0


async def test_list_patients_search_matches_email_from_the_start_only_when_term_contains_at(db_session):
    """Email matching only activates when the search term contains "@" -- an agent
    typing/pasting an actual email address -- and even then, only from the start of the
    address (not searching by "ANGELA30" alone, which contains no "@").
    """
    db_session.add_all([
        make_patient(id="pat_1", email="angela30@example.com"),
        make_patient(id="pat_2", email="someoneelse@example.com"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters(search="ANGELA30@EXAMPLE"))

    assert [item.id for item in result.items] == ["pat_1"]


async def test_list_patients_search_does_not_match_email_for_a_plain_name_shaped_term(db_session):
    """Regression test for a real reported bug that survived the earlier anchoring fix:
    searching "alicia" (a plain name, no "@") still returned "Elizabeth Blackburn" and
    "Karen Garcia" -- completely unrelated patients -- because their real, randomly
    generated emails legitimately START WITH "alicia" ("alicia50@example.net",
    "alicia00@example.com"). Anchoring alone cannot distinguish a coincidental
    anchored match from a real one, so a plain name-shaped term must not search email at
    all -- only a term that already contains "@" does.
    """
    db_session.add_all([
        make_patient(id="pat_1", first_name="Alicia", last_name="Abbott", email="iwilkins@example.org"),
        make_patient(id="pat_2", first_name="Elizabeth", last_name="Blackburn", email="alicia50@example.net"),
        make_patient(id="pat_3", first_name="Karen", last_name="Garcia", email="alicia00@example.com"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters(search="alicia"))

    assert [item.id for item in result.items] == ["pat_1"]  # only the real Alicia


async def test_list_patients_search_matches_phone_anywhere(db_session):
    """Phone search stays an unanchored substring match (unlike email) -- a caller is often
    identified by a recognizable fragment of their number (e.g. the last four digits) rather
    than always the start of it, so anchoring it the same way email was would break that.
    """
    db_session.add_all([
        make_patient(id="pat_1", phone="(555) 123-4567"),
        make_patient(id="pat_2", phone="(555) 999-0000"),
    ])
    await db_session.commit()

    result = await list_patients(db_session, PatientFilters(search="4567"))

    assert [item.id for item in result.items] == ["pat_1"]


async def test_list_rebooking_opportunities_selects_past_only_patients_sorted_most_recent_first(db_session):
    """Covers the Rebooking Opportunities contract in one seeded scenario, anchored to
    reference_date = 2026-01-01 (set by the Feb 2026 appointment below):

    - pat_a and pat_b both have only past (non-cancelled) appointments and nothing
      scheduled today or later -- both qualify, sorted by last visit, most recent first
      (pat_a's Dec 20 visit before pat_b's Dec 1 visit).
    - pat_c has an appointment scheduled exactly on the reference date (today) -- excluded
      entirely, since "today" counts as already having something on the books.
    - pat_d has an appointment further in the future -- excluded, same reasoning.
    - pat_e's only appointment is cancelled -- excluded; a cancelled booking isn't a real
      past visit to rebook from.
    - pat_f has no appointments at all -- excluded; never having been a real patient isn't
      the same as lapsing.
    """
    db_session.add_all([
        make_patient(id="pat_a", first_name="Alice", last_name="Anderson"),
        make_patient(id="pat_b", first_name="Bob", last_name="Baker"),
        make_patient(id="pat_c", first_name="Carol", last_name="Carter"),
        make_patient(id="pat_d", first_name="Dana", last_name="Dean"),
        make_patient(id="pat_e", first_name="Eve", last_name="Evans"),
        make_patient(id="pat_f", first_name="Frank", last_name="Foster"),
        make_provider(), make_service(),
        make_appointment(id="apt_a", patient_id="pat_a", status="confirmed"),
        make_appointment(id="apt_b", patient_id="pat_b", status="confirmed"),
        make_appointment(id="apt_c_today", patient_id="pat_c", status="confirmed"),
        make_appointment(id="apt_d_future", patient_id="pat_d", status="confirmed"),
        make_appointment(id="apt_e_cancelled", patient_id="pat_e", status="cancelled"),
        make_appointment(id="apt_latest", patient_id="pat_d", status="confirmed"),  # sets the latest data month
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(appointment_id="apt_a", start=datetime(2025, 12, 20, 9, 0), end=datetime(2025, 12, 20, 9, 30)),
        make_appointment_service(appointment_id="apt_b", start=datetime(2025, 12, 1, 9, 0), end=datetime(2025, 12, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_c_today", start=datetime(2026, 1, 1, 9, 0), end=datetime(2026, 1, 1, 9, 30)),
        make_appointment_service(appointment_id="apt_d_future", start=datetime(2026, 1, 15, 9, 0), end=datetime(2026, 1, 15, 9, 30)),
        make_appointment_service(appointment_id="apt_e_cancelled", start=datetime(2025, 12, 10, 9, 0), end=datetime(2025, 12, 10, 9, 30)),
        make_appointment_service(appointment_id="apt_latest", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
    ])
    await db_session.commit()

    result = await list_rebooking_opportunities(db_session)

    assert result.reference_date == date(2026, 1, 1)
    assert [item.id for item in result.items] == ["pat_a", "pat_b"]  # most recent visit first
    assert result.items[0].last_appointment_date == datetime(2025, 12, 20, 9, 0)
    assert result.items[0].last_service_name == "Consultation"  # make_service()'s default name
    assert result.items[0].last_provider_name == "Dr Smith"  # make_provider()'s default name


async def test_list_rebooking_opportunities_last_service_and_provider_come_from_the_latest_row_specifically(db_session):
    """When a patient's last appointment had multiple services (e.g. a consultation followed
    by an X-ray, possibly with different providers), last_service_name/last_provider_name
    must come from whichever single AppointmentService row actually started latest -- not
    the first one on the appointment, not an arbitrary one.
    """
    db_session.add_all([
        make_patient(id="pat_a", first_name="Alice", last_name="Anderson"),
        make_patient(id="pat_b", first_name="Bob", last_name="Baker"),
        make_provider(id="prv_1", first_name="Ann", last_name="Early"),
        make_provider(id="prv_2", first_name="Bob", last_name="Late"),
        make_service(id="svc_1", name="Consultation"),
        make_service(id="svc_2", name="X-Ray"),
        make_appointment(id="apt_multi", patient_id="pat_a", status="confirmed"),
        # A different patient's future appointments (in TWO further-out months, Jan and Feb
        # 2026) set the reference anchor to Jan 2026 -- the second-to-last of three distinct
        # months (Dec 2025, Jan 2026, Feb 2026) -- so pat_a's Dec 2025 visit lands safely
        # before it. Anchoring to Dec 2025 itself (with only two distinct months in the
        # data) would put pat_a's own Dec 20 visit ON-OR-AFTER the reference date, wrongly
        # flagging them as having an upcoming appointment via the has_upcoming anti-join.
        # Attaching these to pat_a instead of a separate patient would have the same
        # problem: it would directly give pat_a an upcoming booking.
        make_appointment(id="apt_month_jan", patient_id="pat_b", status="confirmed"),
        make_appointment(id="apt_month_feb", patient_id="pat_b", status="confirmed"),
    ])
    await db_session.flush()
    db_session.add_all([
        make_appointment_service(
            appointment_id="apt_multi", service_id="svc_1", provider_id="prv_1",
            start=datetime(2025, 12, 20, 9, 0), end=datetime(2025, 12, 20, 9, 30),
        ),
        make_appointment_service(
            appointment_id="apt_multi", service_id="svc_2", provider_id="prv_2",
            start=datetime(2025, 12, 20, 10, 0), end=datetime(2025, 12, 20, 10, 30),
        ),
        make_appointment_service(appointment_id="apt_month_jan", start=datetime(2026, 1, 5, 10, 0), end=datetime(2026, 1, 5, 10, 30)),
        make_appointment_service(appointment_id="apt_month_feb", start=datetime(2026, 2, 1, 10, 0), end=datetime(2026, 2, 1, 10, 30)),
    ])
    await db_session.commit()

    result = await list_rebooking_opportunities(db_session)

    by_id = {item.id: item for item in result.items}
    assert by_id["pat_a"].last_appointment_date == datetime(2025, 12, 20, 10, 0)  # the LATER of the two services
    assert by_id["pat_a"].last_service_name == "X-Ray"  # not "Consultation" (the earlier one)
    assert by_id["pat_a"].last_provider_name == "Bob Late"  # not "Ann Early"
