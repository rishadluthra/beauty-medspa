"use client";

/**
 * Drag-and-drop reorder modal, shared by the "All Graphs" tab (reordering
 * `GET/PUT /api/graph-order`) and each custom view tab (reordering that
 * view's own `chart_refs` via `PUT /api/custom-views/{id}`) -- the caller
 * decides which endpoint `onSave` actually calls; this component only
 * knows about the generic "ordered list of {ref, label, isDefault}" shape.
 *
 * `allowRemove` is what tells the two callers apart in the UI: the "All
 * Graphs" tab only reorders (a default chart can't be removed from it, and
 * a custom graph is removed by actually deleting it via its own Delete
 * button, not from here), while a view's own reorder modal doubles as its
 * "remove from view" control, since curating a view's contents doesn't
 * touch the underlying graph at all.
 */

import { useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { ResolvedChartRef } from "@/lib/chartRefs";

import { GraphBadge } from "./GraphBadge";

function SortableRow({ item, allowRemove, onRemove }: { item: ResolvedChartRef; allowRemove?: boolean; onRemove: (ref: string) => void }) {
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
      {allowRemove && (
        <button
          type="button"
          onClick={() => onRemove(item.ref)}
          aria-label={`Remove ${item.label} from this view`}
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
  allowRemove?: boolean;
  isSaving?: boolean;
  onSave: (refs: string[]) => void;
  onClose: () => void;
}

export function ReorderModal({ title, items: initialItems, allowRemove = false, isSaving = false, onSave, onClose }: Props) {
  const [items, setItems] = useState(initialItems);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-brand-dark shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-brand-dark/60">
          Drag to reorder{allowRemove ? ", or remove a graph from this view" : ""}.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.ref)} strategy={verticalListSortingStrategy}>
            <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <SortableRow
                  key={item.ref}
                  item={item}
                  allowRemove={allowRemove}
                  onRemove={(ref) => setItems((prev) => prev.filter((i) => i.ref !== ref))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

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
            {isSaving ? "Saving…" : "Save Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
