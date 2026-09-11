"""Repository functions backing custom views and the "All Graphs" order.

Part of the data-access layer described in `app.repositories.__init__`,
alongside `app.repositories.custom_reports` (the two features share the
same "self-serve analytics" bonus and the same non-GET-methods CORS
carve-out in `app.main`).

`DEFAULT_CHART_KEYS` is the stable identifier list for the 7 fixed charts
that already exist on the Analytics page (Revenue Over Time, ...) -- it's
what lets a "default:<key>" chart ref sit in the same ordered list as a
"custom:<report_id>" ref, so a custom view or the "All Graphs" order can
freely mix references to both kinds of graph. This list must stay in sync
with the frontend's own default-chart registry (`lib/defaultCharts.tsx`)
-- there's no shared codegen, same as every other enum-ish list in this
app's API contract.
"""

import secrets
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CustomView, GraphOrder

DEFAULT_CHART_KEYS = [
    "revenue_over_time",
    "patients_by_source",
    "top_services_by_bookings",
    "provider_utilization",
    "top_services_by_revenue",
    "patients_by_gender",
    "patients_by_age_group",
]

# The actual ref strings a chart-ref list (graph_order / a view's chart_refs)
# stores for the 7 default charts -- `DEFAULT_CHART_KEYS` above is the bare
# key list (also exported for anything that just needs to recognize a key),
# but every ref stored anywhere is always the prefixed `"default:<key>"`
# form, matching `"custom:<report_id>"`'s own prefix.
DEFAULT_CHART_REFS = [f"default:{key}" for key in DEFAULT_CHART_KEYS]

MAX_CUSTOM_VIEWS = 3

_GRAPH_ORDER_ROW_ID = "singleton"


async def get_graph_order(db: AsyncSession) -> list[str]:
    """Return the "All Graphs" tab's current display order.

    Lazily creates the singleton row (seeded with `DEFAULT_CHART_REFS`, in
    their natural order) the first time this is ever called against a
    fresh database, rather than requiring a separate seed step -- there's
    nothing meaningful to seed this with ahead of time since it only
    starts mattering once someone visits the Analytics page.
    """
    row = await db.get(GraphOrder, _GRAPH_ORDER_ROW_ID)
    if row is None:
        row = GraphOrder(id=_GRAPH_ORDER_ROW_ID, chart_refs=list(DEFAULT_CHART_REFS), updated_date=datetime.utcnow())
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return list(row.chart_refs)


async def set_graph_order(db: AsyncSession, chart_refs: list[str]) -> list[str]:
    """Replace the "All Graphs" tab's display order wholesale (used by the reorder modal)."""
    await get_graph_order(db)  # ensures the row exists
    row = await db.get(GraphOrder, _GRAPH_ORDER_ROW_ID)
    row.chart_refs = list(chart_refs)
    row.updated_date = datetime.utcnow()
    await db.commit()
    return list(row.chart_refs)


async def prepend_to_graph_order(db: AsyncSession, chart_ref: str) -> None:
    """Insert a newly-created custom report's ref at the FRONT of the "All Graphs" order.

    Called from `custom_reports.create_custom_report` -- per direct
    request, a freshly built graph should appear at the very top of "All
    Graphs", not appended to the bottom, regardless of whether the order
    has ever been manually reordered before.
    """
    current = await get_graph_order(db)
    # Defensive de-dupe: a ref should never already be present for a
    # brand-new report id, but guarding against it keeps this idempotent.
    deduped = [chart_ref] + [ref for ref in current if ref != chart_ref]
    await set_graph_order(db, deduped)


async def remove_from_graph_order(db: AsyncSession, chart_ref: str) -> None:
    """Drop a deleted custom report's ref from the "All Graphs" order, if present."""
    current = await get_graph_order(db)
    if chart_ref in current:
        await set_graph_order(db, [ref for ref in current if ref != chart_ref])


async def list_custom_views(db: AsyncSession) -> list[CustomView]:
    """Return every saved custom view, oldest first (their tab order)."""
    query = select(CustomView).order_by(CustomView.created_date)
    return list((await db.execute(query)).scalars().all())


async def count_custom_views(db: AsyncSession) -> int:
    """Return how many custom views are currently saved (for the 3-view soft cap)."""
    return (await db.execute(select(func.count(CustomView.id)))).scalar_one()


async def create_custom_view(db: AsyncSession, name: str, chart_refs: list[str]) -> CustomView:
    """Insert and return a new saved custom view."""
    view = CustomView(
        id=f"view_{secrets.token_hex(6)}",
        name=name,
        chart_refs=list(chart_refs),
        created_date=datetime.utcnow(),
    )
    db.add(view)
    await db.commit()
    await db.refresh(view)
    return view


async def update_custom_view_refs(db: AsyncSession, view_id: str, chart_refs: list[str]) -> CustomView | None:
    """Replace a view's chart_refs (reordering, or removing an item from the view).

    Returns `None` if no view had that id, without raising -- the router
    turns that into a 404.
    """
    view = await db.get(CustomView, view_id)
    if view is None:
        return None
    view.chart_refs = list(chart_refs)
    await db.commit()
    await db.refresh(view)
    return view


async def delete_custom_view(db: AsyncSession, view_id: str) -> bool:
    """Delete a saved custom view. Returns False if no view had that id."""
    view = await db.get(CustomView, view_id)
    if view is None:
        return False
    await db.delete(view)
    await db.commit()
    return True
