"use client";

/**
 * Shared graph picker -- checkboxes over every default chart + every saved
 * custom report, plus a brand new graph created right here inline (the
 * same create form as the main "Create New Graph" button, nested -- see
 * `BuildCustomAnalyticsModal`'s `nested` prop). Two modes, reusing one
 * component rather than maintaining near-duplicate UIs:
 *
 *  - `"create"`: the "Create Custom View" flow -- asks for a view name,
 *    and submitting POSTs a brand new view with the selected refs. A view
 *    is a live reference list, not a data snapshot (see
 *    `app.models.custom_view`'s docstring on the backend).
 *  - `"add"`: the Edit View modal's "+ Add Graphs" flow -- no name field,
 *    `excludeRefs` hides graphs already in that view, and submitting just
 *    hands the selected refs back via `onAdd` for the caller to merge into
 *    its own staged list (nothing is persisted here; the Edit View modal's
 *    own "Save Changes" is what actually saves the updated view).
 */

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { customRef, defaultRef } from "@/lib/chartRefs";
import { DEFAULT_CHARTS } from "@/lib/defaultCharts";
import type { CustomReport, CustomView } from "@/lib/types";

import { BuildCustomAnalyticsModal } from "./BuildCustomAnalyticsModal";
import { GraphBadge } from "./GraphBadge";

interface Props {
  mode: "create" | "add";
  customReports: CustomReport[];
  /** `"add"` mode only: refs already present elsewhere (e.g. already in the view), hidden from the list. */
  excludeRefs?: string[];
  onClose: () => void;
  /** `"create"` mode only. */
  onViewCreated?: (view: CustomView) => void;
  onViewFailed?: () => void;
  /** `"add"` mode only -- the selected refs, for the caller to merge into its own staged list. */
  onAdd?: (refs: string[]) => void;
  onGraphCreated: () => void;
  onGraphFailed: () => void;
}

export function GraphPickerModal({ mode, customReports, excludeRefs, onClose, onViewCreated, onViewFailed, onAdd, onGraphCreated, onGraphFailed }: Props) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNewGraphModal, setShowNewGraphModal] = useState(false);
  const queryClient = useQueryClient();

  const excludeSet = useMemo(() => new Set(excludeRefs ?? []), [excludeRefs]);
  const allItems = useMemo(
    () => [
      ...DEFAULT_CHARTS.map((c) => ({ ref: defaultRef(c.key), label: c.label, isDefault: true as const })),
      ...customReports.map((r) => ({ ref: customRef(r.id), label: r.title, isDefault: false as const })),
    ].filter((item) => !excludeSet.has(item.ref)),
    [customReports, excludeSet],
  );

  const toggle = (ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: () => api.createCustomView({ name: name.trim(), chart_refs: allItems.map((i) => i.ref).filter((ref) => selected.has(ref)) }),
    onSuccess: (view) => {
      queryClient.invalidateQueries({ queryKey: ["custom-views"] });
      onViewCreated?.(view);
      onClose();
    },
    onError: () => onViewFailed?.(),
  });

  const isCreate = mode === "create";
  const canSubmit = isCreate ? name.trim().length > 0 && selected.size > 0 : selected.size > 0;

  const handleSubmit = () => {
    if (isCreate) {
      createMutation.mutate();
    } else {
      onAdd?.(allItems.map((i) => i.ref).filter((ref) => selected.has(ref)));
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-brand-dark shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold">{isCreate ? "Create Custom View" : "Add Graphs to View"}</h2>
          <p className="mt-1 text-sm text-brand-dark/60">
            {isCreate ? "Pick which graphs this view should show, or build a new one." : "Pick graphs to add to this view, or build a new one."}
          </p>

          {isCreate && (
            <label className="mt-4 block shrink-0">
              <span className="text-sm font-medium text-brand-dark/80">
                View name<span className="ml-0.5 text-brand-gold-dark" aria-hidden="true">*</span>
              </span>
              <input
                type="text"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marketing Dashboard"
                className="mt-1 w-full rounded-lg border border-brand-dark/20 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-gold focus:outline-none"
              />
            </label>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-medium text-brand-dark/80">Graphs</span>
            <button
              type="button"
              onClick={() => setShowNewGraphModal(true)}
              className="rounded-full border border-brand-dark/20 px-3 py-1 text-xs text-brand-dark/70 transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
            >
              + New Graph
            </button>
          </div>

          <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto">
            {allItems.length === 0 && <p className="text-sm text-brand-dark/50">Every graph is already in this view.</p>}
            {allItems.map((item) => (
              <label
                key={item.ref}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-brand-dark/10 bg-white px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.ref)}
                  onChange={() => toggle(item.ref)}
                  className="h-4 w-4 accent-brand-gold"
                />
                <span className="flex-1 truncate text-sm text-brand-dark">{item.label}</span>
                <GraphBadge isDefault={item.isDefault} />
              </label>
            ))}
          </div>

          {createMutation.isError && <p className="mt-2 text-sm text-coral">{(createMutation.error as Error).message}</p>}

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
              disabled={createMutation.isPending || !canSubmit}
              onClick={handleSubmit}
              className="rounded-full bg-brand-gold px-4 py-1.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreate ? (createMutation.isPending ? "Creating…" : "Create View") : "Add Selected"}
            </button>
          </div>
        </div>
      </div>

      {showNewGraphModal && (
        <BuildCustomAnalyticsModal
          nested
          onClose={() => setShowNewGraphModal(false)}
          onCreated={(report) => {
            setSelected((prev) => new Set(prev).add(customRef(report.id)));
            onGraphCreated();
          }}
          onFailed={onGraphFailed}
        />
      )}
    </>
  );
}
