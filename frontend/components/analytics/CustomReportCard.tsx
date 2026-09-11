"use client";

/**
 * One saved custom report from the self-serve "Build Custom Analytics"
 * feature: a title, a delete control, and a multi-line chart pivoted from
 * the report's flat `data: CustomReportPoint[]` (one point per (period,
 * dimension_value) cell) -- one Line per distinct `dimension_value` (e.g.
 * one line per provider), x-axis = period.
 *
 * No subtitle line under the title -- an earlier version repeated the
 * metric/dimension/time-grain as grey text under the user's own chosen
 * title, which was redundant (per direct feedback: "I don't get the point
 * of allowing someone to name the graph and then also having a grey text
 * below it saying what the graph is").
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
import { formatLabel } from "@/lib/format";
import type { CustomReport } from "@/lib/types";

/** Pivots a report's flat point list into one row per period, with one column per dimension value. */
function pivot(report: CustomReport): { rows: Record<string, string | number>[]; seriesNames: string[] } {
  // `source` dimension values come straight from the backend's raw
  // `Patient.source` enum ("in_person", not "In Person") -- provider/service
  // dimension values are already human names (joined server-side against
  // Provider.name/Service.name), so only `source` needs this. `formatLabel`
  // is the same "in_person" -> "In Person" helper the rest of the Analytics
  // page already uses (SourceBreakdownChart, DemographicsChart) for the
  // exact same raw-enum-value problem.
  const points = report.dimension === "source"
    ? report.data.map((p) => ({ ...p, dimension_value: formatLabel(p.dimension_value) }))
    : report.data;

  const periods = Array.from(new Set(points.map((p) => p.period))).sort();
  const seriesNames = Array.from(new Set(points.map((p) => p.dimension_value))).sort();

  const rows = periods.map((period) => {
    const row: Record<string, string | number> = { period };
    for (const point of points.filter((p) => p.period === period)) {
      row[point.dimension_value] = report.metric === "revenue_cents" ? point.value / 100 : point.value;
    }
    return row;
  });

  return { rows, seriesNames };
}

interface Props {
  report: CustomReport;
  /** Called after a successful delete, so the page can show the same toast confirmation create uses. */
  onDeleted: () => void;
  /** Called if the delete request fails. */
  onDeleteFailed: () => void;
}

export function CustomReportCard({ report, onDeleted, onDeleteFailed }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCustomReport(report.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-reports"] });
      onDeleted();
    },
    onError: () => onDeleteFailed(),
  });

  const { rows, seriesNames } = useMemo(() => pivot(report), [report]);
  const isRevenue = report.metric === "revenue_cents";
  const formatValue = (v: number) => (isRevenue ? `$${v.toLocaleString()}` : v.toLocaleString());
  const maxValue = Math.max(0, ...rows.flatMap((row) => seriesNames.map((s) => Number(row[s]) || 0)));
  const yAxisWidth = estimateAxisWidth([formatValue(maxValue)]);
  const chartHeight = 380;

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="font-medium text-brand-dark">{report.title}</h2>
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
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tickMargin={8} />
            <YAxis width={yAxisWidth} tickMargin={8} tickFormatter={(v) => formatValue(v as number)} />
            {/*
              A pinned `position` (rather than Recharts' default of following
              the cursor) keeps the tooltip predictable and clear of the
              Legend's own column on the right -- it only ever grows downward
              from the plot's top-left corner into the plot's own space.
            */}
            <Tooltip formatter={(v) => formatValue(v as number)} position={{ x: 50, y: 4 }} wrapperStyle={{ zIndex: 30 }} />
            {/*
              A vertical legend in its own column on the right -- not
              Recharts' default horizontal row that wraps below the chart --
              is what actually fixes "the legend looks unorganized": with up
              to 10 series, a wrapped horizontal legend produced a ragged,
              uneven multi-row block with no clear reading order. A single
              vertical column, one name per line, reads top-to-bottom exactly
              like the report's own dimension list would in a table. The
              chart is now full page-width (see the Analytics page's custom-
              reports section), which is what makes room for this column
              without shrinking the plot itself. `maxHeight` + `overflowY`
              caps the column at the chart's own height rather than letting
              10 rows push the card taller than intended, in case a future
              dimension ever has more values than fit comfortably.
            */}
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ maxHeight: chartHeight - 32, overflowY: "auto", paddingLeft: 16, lineHeight: "1.9rem" }}
            />
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
