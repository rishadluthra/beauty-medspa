"use client";

/**
 * "Build Custom Analytics" modal — the self-serve pivot builder (metric x
 * dimension x time grain) behind the Analytics page's own button. Submitting
 * calls `api.createCustomReport` (the API's first write path outside this
 * one feature) and, on success, invalidates the `["custom-reports"]` query
 * so the newly saved report's card appears on the page without a manual
 * refetch wire-up here.
 *
 * The option lists below (`METRIC_OPTIONS`/`DIMENSION_OPTIONS`/
 * `TIME_GRAIN_OPTIONS`) must stay in sync with the backend's `Metric`/
 * `Dimension`/`TimeGrain` enums in `app/schemas/custom_reports.py` -- there's
 * no shared codegen between the two, same as every other type in `lib/types.ts`.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { CustomReportDimension, CustomReportMetric, CustomReportTimeGrain } from "@/lib/types";

const METRIC_OPTIONS: { value: CustomReportMetric; label: string }[] = [
  { value: "appointment_count", label: "Appointment Count" },
  { value: "revenue_cents", label: "Revenue" },
  { value: "unique_patient_count", label: "Unique Patients" },
];

const DIMENSION_OPTIONS: { value: CustomReportDimension; label: string }[] = [
  { value: "provider", label: "Provider" },
  { value: "service", label: "Service" },
  { value: "source", label: "Marketing Source" },
];

const TIME_GRAIN_OPTIONS: { value: CustomReportTimeGrain; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

interface Props {
  onClose: () => void;
}

/**
 * The modal's own form state + submit handling. Rendered by
 * `BuildCustomAnalyticsButton` only while open, so this component's state
 * always starts fresh -- no reset-on-close logic needed.
 */
export function BuildCustomAnalyticsModal({ onClose }: Props) {
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<CustomReportMetric>("revenue_cents");
  const [dimension, setDimension] = useState<CustomReportDimension>("provider");
  const [timeGrain, setTimeGrain] = useState<CustomReportTimeGrain>("month");

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.createCustomReport({ title: title.trim(), metric, dimension, time_grain: timeGrain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-reports"] });
      onClose();
    },
  });

  return (
    // The overlay itself closes the modal on click; the panel stops that click from
    // bubbling up, so clicking inside the form doesn't also dismiss it.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-brand-dark shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Build Custom Analytics</h2>
        <p className="mt-1 text-sm text-brand-dark/60">Pick a metric, break it down, and choose a time grain.</p>

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) mutation.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm font-medium text-brand-dark/80">Title</span>
            <input
              type="text"
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Revenue by Provider"
              className="mt-1 w-full rounded-lg border border-brand-dark/20 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-gold focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-brand-dark/80">Metric</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as CustomReportMetric)}
              className="mt-1 w-full rounded-lg border border-brand-dark/20 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-gold focus:outline-none"
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-brand-dark/80">Broken down by</span>
            <select
              value={dimension}
              onChange={(e) => setDimension(e.target.value as CustomReportDimension)}
              className="mt-1 w-full rounded-lg border border-brand-dark/20 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-gold focus:outline-none"
            >
              {DIMENSION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-brand-dark/80">Time grain</span>
            <select
              value={timeGrain}
              onChange={(e) => setTimeGrain(e.target.value as CustomReportTimeGrain)}
              className="mt-1 w-full rounded-lg border border-brand-dark/20 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-gold focus:outline-none"
            >
              {TIME_GRAIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          {mutation.isError && (
            <p className="text-sm text-coral">{(mutation.error as Error).message}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-brand-dark/20 px-4 py-1.5 text-sm text-brand-dark/70 transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !title.trim()}
              className="rounded-full bg-brand-gold px-4 py-1.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
