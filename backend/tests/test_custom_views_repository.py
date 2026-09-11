"""Repository-level tests for custom views and the "All Graphs" order."""

from app.repositories.custom_reports import create_custom_report, delete_custom_report
from app.repositories.custom_views import (
    DEFAULT_CHART_REFS,
    count_custom_views,
    create_custom_view,
    delete_custom_view,
    get_graph_order,
    list_custom_views,
    prepend_to_graph_order,
    remove_from_graph_order,
    set_graph_order,
    update_custom_view_refs,
)
from app.schemas.custom_reports import Dimension, Metric, TimeGrain


async def test_get_graph_order_lazily_seeds_with_default_chart_keys(db_session):
    """The first ever read creates the singleton row, seeded with the default charts."""
    order = await get_graph_order(db_session)
    assert order == DEFAULT_CHART_REFS

    # A second read returns the same persisted row, not a fresh seed.
    order_again = await get_graph_order(db_session)
    assert order_again == order


async def test_set_graph_order_replaces_it_wholesale(db_session):
    await get_graph_order(db_session)  # seed it first
    reordered = list(reversed(DEFAULT_CHART_REFS))
    result = await set_graph_order(db_session, reordered)
    assert result == reordered
    assert await get_graph_order(db_session) == reordered


async def test_creating_a_custom_report_prepends_it_to_graph_order(db_session):
    """A newly created report's ref lands at the FRONT of the order, not appended."""
    report = await create_custom_report(
        db_session, title="Revenue by provider", metric=Metric.revenue_cents,
        dimension=Dimension.provider, time_grain=TimeGrain.month,
    )
    order = await get_graph_order(db_session)
    assert order[0] == f"custom:{report.id}"
    assert order[1:] == DEFAULT_CHART_REFS


async def test_creating_two_reports_puts_the_newest_at_the_very_front(db_session):
    first = await create_custom_report(
        db_session, title="Report A", metric=Metric.revenue_cents,
        dimension=Dimension.provider, time_grain=TimeGrain.month,
    )
    second = await create_custom_report(
        db_session, title="Report B", metric=Metric.appointment_count,
        dimension=Dimension.service, time_grain=TimeGrain.quarter,
    )
    order = await get_graph_order(db_session)
    assert order[0] == f"custom:{second.id}"
    assert order[1] == f"custom:{first.id}"


async def test_deleting_a_custom_report_removes_it_from_graph_order(db_session):
    report = await create_custom_report(
        db_session, title="Report A", metric=Metric.revenue_cents,
        dimension=Dimension.provider, time_grain=TimeGrain.month,
    )
    assert f"custom:{report.id}" in await get_graph_order(db_session)

    await delete_custom_report(db_session, report.id)

    order = await get_graph_order(db_session)
    assert f"custom:{report.id}" not in order
    assert order == DEFAULT_CHART_REFS


async def test_prepend_and_remove_helpers_are_idempotent(db_session):
    """Calling prepend/remove directly (not just via create/delete) behaves safely."""
    await prepend_to_graph_order(db_session, "custom:rpt_fake")
    order = await get_graph_order(db_session)
    assert order[0] == "custom:rpt_fake"
    assert order.count("custom:rpt_fake") == 1

    # Prepending the same ref again doesn't duplicate it.
    await prepend_to_graph_order(db_session, "custom:rpt_fake")
    order_again = await get_graph_order(db_session)
    assert order_again.count("custom:rpt_fake") == 1

    # Removing a ref that isn't present is a no-op, not an error.
    await remove_from_graph_order(db_session, "custom:rpt_does_not_exist")
    assert await get_graph_order(db_session) == order_again


async def test_create_list_update_and_delete_custom_view_roundtrip(db_session):
    created = await create_custom_view(
        db_session, name="Marketing Dashboard",
        chart_refs=["default:revenue_over_time", "default:patients_by_source"],
    )
    assert created.id.startswith("view_")
    assert await count_custom_views(db_session) == 1

    listed = await list_custom_views(db_session)
    assert [v.id for v in listed] == [created.id]

    updated = await update_custom_view_refs(db_session, created.id, ["default:patients_by_source"])
    assert updated.chart_refs == ["default:patients_by_source"]

    assert await update_custom_view_refs(db_session, "view_does_not_exist", []) is None

    deleted = await delete_custom_view(db_session, created.id)
    assert deleted is True
    assert await count_custom_views(db_session) == 0
    assert await delete_custom_view(db_session, "view_does_not_exist") is False
