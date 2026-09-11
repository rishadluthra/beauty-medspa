"use client";

/**
 * "Create Custom View" picker -- lets someone build a named, curated
 * dashboard tab out of graphs that already exist (checkboxes over every
 * default chart + every saved custom report) or a brand new graph created
 * right here inline (the same create form as the main "Create New Graph"
 * button, nested -- see `BuildCustomAnalyticsModal`'s `nested` prop).
 *
 * A view is a live reference list, not a data snapshot (see
 * `app.models.custom_view`'s docstring on the backend): submitting here
 * just POSTs the selected refs, in the order they appear in this picker's
 * own list (defaults first, then customs by creation order) -- the
 * view's OWN reorder modal is where someone rearranges that afterward.
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
  customReports: CustomReport[];
  onClose: () => void;
  onViewCreated: (view: CustomView) => void;
  onViewFailed: () => void;
  onGraphCreated: () => void;
  onGraphFailed: () => void;
}

export function CreateCustomViewModal({ customReports, onClose, onViewCreated, onViewFailed, onGraphCreated, onGraphFailed }: Props) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNewGraphModal, setShowNewGraphModal] = useState(false);
  const queryClient = useQueryClient();

  const allItems = useMemo(
    () => [
      ...DEFAULT_CHARTS.map((c) => ({ ref: defaultRef(c.key), label: c.label, isDefault: true as const })),
      ...customReports.map((r) => ({ ref: customRef(r.id), label: r.title, isDefault: false as const })),
    ],
    [customReports],
  );

  const toggle = (ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: () => api.createCustomView({ name: name.trim(), chart_refs: allItems.map((i) => i.ref).filter((ref) => selected.has(ref)) }),
    onSuccess: (view) => {
      queryClient.invalidateQueries({ queryKey: ["custom-views"] });
      onViewCreated(view);
      onClose();
    },
    onError: () => onViewFailed(),
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-brand-dark shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold">Create Custom View</h2>
          <p className="mt-1 text-sm text-brand-dark/60">Pick which graphs this view should show, or build a new one.</p>

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

          {mutation.isError && <p className="mt-2 text-sm text-coral">{(mutation.error as Error).message}</p>}

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
              disabled={mutation.isPending || !name.trim() || selected.size === 0}
              onClick={() => mutation.mutate()}
              className="rounded-full bg-brand-gold px-4 py-1.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? "Creating…" : "Create View"}
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
