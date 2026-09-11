"use client";

/**
 * One saved custom report from the self-serve "Build Custom Analytics"
 * feature: a title, a delete control, and a multi-line chart pivoted from
 * the report's flat `data: CustomReportPoint[]` (one point per (period,
 * dimension_value) cell) -- one Line per distinct `dimension_value` (e.g.
 * one line per provider), x-axis = period.
 *
 * Delete is a two-click confirm (not a bare single click, and not a
 * browser-native `confirm()` that would clash with the app's own modal
 * styling) -- deleting a saved report has no undo, but this app has no
 * per-user ownership to gate it behind either, so a lightweight inline
 * confirm is the right amount of friction.
 */

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { estimateAxisWidth } from "@/lib/chartAxis";
import { CATEGORICAL_PALETTE } from "@/lib/chartColors";
import type { CustomReport } from "@/lib/types";

const METRIC_LABELS: Record<CustomReport["metric"], string> = {
  appointment_count: "Appointments",
  revenue_cents: "Revenue",
  unique_patient_count: "Unique Patients",
};

/** Pivots a report's flat point list into one row per period, with one column per dimension value. */
function pivot(report: CustomReport): { rows: Record<string, string | number>[]; seriesNames: string[] } {
  const periods = Array.from(new Set(report.data.map((p) => p.period))).sort();
  const seriesNames = Array.from(new Set(report.data.map((p) => p.dimension_value))).sort();

  const rows = periods.map((period) => {
    const row: Record<string, string | number> = { period };
    for (const point of report.data.filter((p) => p.period === period)) {
      row[point.dimension_value] = report.metric === "revenue_cents" ? point.value / 100 : point.value;
    }
    return row;
  });

  return { rows, seriesNames };
}

export function CustomReportCard({ report }: { report: CustomReport }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCustomReport(report.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-reports"] }),
  });

  const { rows, seriesNames } = useMemo(() => pivot(report), [report]);
  const isRevenue = report.metric === "revenue_cents";
  const formatValue = (v: number) => (isRevenue ? `$${v.toLocaleString()}` : v.toLocaleString());
  const maxValue = Math.max(0, ...rows.flatMap((row) => seriesNames.map((s) => Number(row[s]) || 0)));
  const yAxisWidth = estimateAxisWidth([formatValue(maxValue)]);

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-brand-dark">{report.title}</h2>
          <p className="text-xs text-brand-dark/50">
            {METRIC_LABELS[report.metric]} by {report.dimension} · {report.time_grain === "month" ? "Monthly" : "Quarterly"}
          </p>
        </div>
        {confirmingDelete ? (
          <div className="flex shrink-0 items-center gap-1 text-xs">
            <span className="text-brand-dark/60">Delete?</span>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              className="rounded-full border border-coral px-2 py-1 text-coral transition-colors hover:bg-coral hover:text-white disabled:opacity-50"
            >
              {deleteMutation.isPending ? "…" : "Yes"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-full border border-brand-dark/20 px-2 py-1 text-brand-dark/70 transition-colors hover:border-brand-gold"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Delete ${report.title}`}
            onClick={() => setConfirmingDelete(true)}
            className="shrink-0 rounded-full border border-brand-dark/20 px-3 py-1 text-xs text-brand-dark/60 transition-colors hover:border-coral hover:text-coral"
          >
            Delete
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-brand-bg/70">No data for this combination yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tickMargin={8} />
            <YAxis width={yAxisWidth} tickMargin={8} tickFormatter={(v) => formatValue(v as number)} />
            <Tooltip formatter={(v) => formatValue(v as number)} />
            <Legend />
            {seriesNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                name={name}
                stroke={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]}
                // The palette has 7 colors, but a dimension can have up to 10 distinct
                // values (e.g. provider) -- past one full cycle, dash the line so two
                // series sharing a color (e.g. series 0 and 7) stay visually
                // distinguishable instead of rendering as identical, unlabelable lines.
                strokeDasharray={i >= CATEGORICAL_PALETTE.length ? "6 3" : undefined}
                strokeWidth={2}
                connectNulls
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
