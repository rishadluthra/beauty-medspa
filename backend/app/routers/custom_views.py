"""HTTP routes for custom views and the "All Graphs" order.

Thin wrappers over `app.repositories.custom_views`, same pattern as
`app.routers.custom_reports`. Adds `PUT` to this API's non-GET surface
(see `app.main`'s CORS `allow_methods`) for the two "replace this whole
ordered list" operations: reordering "All Graphs" and reordering (or
removing an item from) one view.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.repositories import custom_views as custom_views_repo
from app.schemas.custom_views import CustomView, CustomViewCreate, GraphOrder, GraphOrderUpdate

router = APIRouter(tags=["custom-views"])


@router.get("/api/graph-order", response_model=GraphOrder)
async def get_graph_order(db: AsyncSession = Depends(get_db)) -> GraphOrder:
    """The "All Graphs" tab's current display order (seeded with the default charts on first read)."""
    return GraphOrder(chart_refs=await custom_views_repo.get_graph_order(db))


@router.put("/api/graph-order", response_model=GraphOrder)
async def put_graph_order(payload: GraphOrderUpdate, db: AsyncSession = Depends(get_db)) -> GraphOrder:
    """Replace the "All Graphs" tab's display order (the reorder modal's save action)."""
    return GraphOrder(chart_refs=await custom_views_repo.set_graph_order(db, payload.chart_refs))


@router.get("/api/custom-views", response_model=list[CustomView])
async def list_views(db: AsyncSession = Depends(get_db)) -> list[CustomView]:
    """List every saved custom view, in tab order (oldest first)."""
    return list(await custom_views_repo.list_custom_views(db))


@router.post("/api/custom-views", response_model=CustomView, status_code=201)
async def create_view(payload: CustomViewCreate, db: AsyncSession = Depends(get_db)) -> CustomView:
    """Save a new custom view. Enforces the 3-view soft cap (same pattern as the saved-report cap)."""
    if await custom_views_repo.count_custom_views(db) >= custom_views_repo.MAX_CUSTOM_VIEWS:
        raise HTTPException(
            status_code=400,
            detail=f"You've reached the limit of {custom_views_repo.MAX_CUSTOM_VIEWS} custom views. Delete one before creating another.",
        )
    return await custom_views_repo.create_custom_view(db, name=payload.name, chart_refs=payload.chart_refs)


@router.put("/api/custom-views/{view_id}", response_model=CustomView)
async def update_view(view_id: str, payload: GraphOrderUpdate, db: AsyncSession = Depends(get_db)) -> CustomView:
    """Replace one view's chart_refs -- reordering within it, or removing an item from it."""
    view = await custom_views_repo.update_custom_view_refs(db, view_id, payload.chart_refs)
    if view is None:
        raise HTTPException(status_code=404, detail="Custom view not found.")
    return view


@router.delete("/api/custom-views/{view_id}", status_code=204)
async def delete_view(view_id: str, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a saved custom view."""
    deleted = await custom_views_repo.delete_custom_view(db, view_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Custom view not found.")
