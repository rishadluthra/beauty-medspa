"use client";

/**
 * "Edit View" modal (renamed from "Reorder", per direct request) -- drag-
 * and-drop reordering, shared by the "All Graphs" tab (reordering
 * `GET/PUT /api/graph-order`) and each custom view tab (reordering that
 * view's own `chart_refs` via `PUT /api/custom-views/{id}`). The caller
 * decides which endpoint `onSave` actually calls; this component only
 * knows about the generic "ordered list of {ref, label, isDefault}" shape.
 *
 * `mode` is what tells the two callers apart in the UI:
 *  - `"allGraphs"`: only CUSTOM rows get a remove control, and removing one
 *    here really does delete that graph everywhere (there's no other
 *    place for "All Graphs" to keep a ref to a graph that no longer
 *    exists) -- a default chart can't be removed at all. The page-level
 *    save handler is responsible for actually deleting any custom graphs
 *    dropped from the list; this component just decides what the final
 *    list looks like and hands it to `onSave`.
 *  - `"view"`: every row (default or custom) gets a remove control, and
 *    removing one only drops it from this view's own list -- the
 *    underlying graph is untouched. This mode also renders the "Delete
 *    This View" control at the bottom, replacing what used to be a
 *    separate page-level "Delete View" button.
 */

import { useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { ResolvedChartRef } from "@/lib/chartRefs";

import { GraphBadge } from "./GraphBadge";

function SortableRow({ item, canRemove, removeLabel, onRemove }: {
  item: ResolvedChartRef;
  canRemove: boolean;
  removeLabel: string;
  onRemove: (ref: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.ref });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-brand-dark/10 bg-white px-3 py-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${item.label}`}
        className="shrink-0 cursor-grab touch-none px-1 text-brand-dark/40 active:cursor-grabbing"
      >
        ⠿
      </button>
      <span className="flex-1 truncate text-sm text-brand-dark">{item.label}</span>
      <GraphBadge isDefault={item.isDefault} />
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(item.ref)}
          aria-label={`${removeLabel} ${item.label}`}
          className="shrink-0 text-brand-dark/40 transition-colors hover:text-coral"
        >
          ✕
        </button>
      )}
    </div>
  );
}

interface Props {
  title: string;
  items: ResolvedChartRef[];
  mode: "allGraphs" | "view";
  isSaving?: boolean;
  onSave: (refs: string[]) => void;
  onClose: () => void;
  /** Only used in `mode === "view"`. */
  onDeleteView?: () => void;
  isDeletingView?: boolean;
}

export function EditViewModal({ title, items: initialItems, mode, isSaving = false, onSave, onClose, onDeleteView, isDeletingView }: Props) {
  const [items, setItems] = useState(initialItems);
  const [confirmingDeleteView, setConfirmingDeleteView] = useState(false);
  // A small drag-activation distance stops an ordinary click (e.g. missing
  // the drag handle by a pixel) from being misread as a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.ref === active.id);
      const newIndex = prev.findIndex((i) => i.ref === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const description = mode === "allGraphs"
    ? "Drag to reorder. Removing a custom graph deletes it -- default charts can't be removed."
    : "Drag to reorder, or remove a graph from this view.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-brand-dark shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-brand-dark/60">{description}</p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.ref)} strategy={verticalListSortingStrategy}>
            <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <SortableRow
                  key={item.ref}
                  item={item}
                  canRemove={mode === "view" || !item.isDefault}
                  removeLabel={mode === "allGraphs" ? "Delete" : "Remove"}
                  onRemove={(ref) => setItems((prev) => prev.filter((i) => i.ref !== ref))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {mode === "view" && (
          <div className="mt-4 shrink-0 border-t border-brand-dark/10 pt-4">
            {confirmingDeleteView ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-brand-dark/60">Delete this entire view?</span>
                <button
                  type="button"
                  disabled={isDeletingView}
                  onClick={onDeleteView}
                  className="rounded-full border border-coral px-3 py-1 text-coral transition-colors hover:bg-coral hover:text-white disabled:opacity-50"
                >
                  {isDeletingView ? "…" : "Yes, delete view"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteView(false)}
                  className="rounded-full border border-brand-dark/20 px-3 py-1 text-brand-dark/70 transition-colors hover:border-brand-gold"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDeleteView(true)}
                className="text-sm font-medium text-coral/80 transition-colors hover:text-coral"
              >
                Delete This View
              </button>
            )}
          </div>
        )}

        <div className="mt-4 flex shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-brand-dark/20 px-4 py-1.5 text-sm text-brand-dark/70 transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || items.length === 0}
            onClick={() => onSave(items.map((i) => i.ref))}
            className="rounded-full bg-brand-gold px-4 py-1.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
