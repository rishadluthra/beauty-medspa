"use client";

/**
 * One saved custom report from the self-serve "Build Custom Analytics"
 * feature: a title, a "Custom" badge, and a multi-line chart pivoted from
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
 * No delete control here anymore -- deleting a graph now happens through
 * the "Edit View" modal (on the "All Graphs" tab specifically, since a
 * view's own Edit modal only removes a graph from that view, not from
 * existence). Keeping delete out of this card removes a second place the
 * same destructive action could be triggered from.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { estimateAxisWidth } from "@/lib/chartAxis";
import { CATEGORICAL_PALETTE } from "@/lib/chartColors";
import { formatLabel } from "@/lib/format";
import type { CustomReport } from "@/lib/types";

import { GraphBadge } from "./GraphBadge";

/** Pivots a report's flat point list into one row per period, with one column per dimension value. */
function pivot(report: CustomReport): { rows: Record<string, string | number>[]; seriesNames: string[] } {
  // `source`/`gender` dimension values come straight from the backend's raw
  // enum columns ("in_person"/"male", not "In Person"/"Male") -- provider,
  // service, and age_bucket values are already display-ready (provider/
  // service are joined server-side against Provider.name/Service.name;
  // age_bucket is already a label like "18-24"), so only source/gender need
  // this. `formatLabel` is the same "in_person" -> "In Person" helper the
  // rest of the Analytics page already uses (SourceBreakdownChart,
  // DemographicsChart) for the exact same raw-enum-value problem.
  const points = report.dimension === "source" || report.dimension === "gender"
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

interface TooltipContentProps {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number; color: string }[];
  formatValue: (v: number) => string;
}

/**
 * A translucent, frosted-glass tooltip -- matching the app's own menu bar
 * styling (`border-brand-gold/10 bg-brand-bg/70 backdrop-blur-xl`) -- per
 * direct request, replacing Recharts' plain opaque-white default box.
 */
function GlassTooltip({ active, label, payload, formatValue }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="max-w-[220px] rounded-2xl border border-brand-gold/10 bg-brand-bg/80 px-4 py-3 text-sm text-brand-dark shadow-lg shadow-brand-gold/10 backdrop-blur-xl">
      <p className="mb-1.5 font-medium">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.dataKey}: {formatValue(entry.value)}
          </p>
        ))}
      </div>
    </div>
  );
}

export function CustomReportCard({ report }: { report: CustomReport }) {
  const { rows, seriesNames } = useMemo(() => pivot(report), [report]);
  const isRevenue = report.metric === "revenue_cents";
  const formatValue = (v: number) => (isRevenue ? `$${v.toLocaleString()}` : v.toLocaleString());
  const maxValue = Math.max(0, ...rows.flatMap((row) => seriesNames.map((s) => Number(row[s]) || 0)));
  const yAxisWidth = estimateAxisWidth([formatValue(maxValue)]);
  const chartHeight = 320;

  // The tooltip's position is computed from the actual cursor, not left to
  // Recharts' own default cursor-tracking, for two reasons discovered live:
  // (1) a fixed pin (tried in an earlier round) covered whatever data was
  // being hovered whenever the cursor happened to be near that pin: worst
  // when inspecting the most recent months, since the pin sat there
  // permanently. (2) Recharts' own default tracking still grew a tall
  // (up to 10-row) tooltip DOWNWARD from wherever the cursor's Y was,
  // which spilled past the chart's own height into the Legend grid below
  // it whenever the cursor wasn't already near the very top -- confirmed
  // live via a real hover screenshot, not guessed. Pinning Y near the top
  // (so the content only ever grows into the plot's own space) while
  // still flipping X to whichever side of the cursor has more room (so it
  // never covers the exact point being inspected) solves both at once.
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => setChartWidth(entries[0].contentRect.width));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const tooltipPosition = hoverX === null
    ? undefined
    : { x: hoverX > chartWidth / 2 ? Math.max(8, hoverX - 232) : hoverX + 24, y: 4 };

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="font-medium text-brand-dark">{report.title}</h2>
        <GraphBadge isDefault={false} />
      </div>

      {rows.length === 0 ? (
        <p className="text-brand-bg/70">No data for this combination yet.</p>
      ) : (
        <>
          <div ref={containerRef}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <LineChart
                data={rows}
                margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                onMouseMove={(state) => {
                  if (state?.activeCoordinate) setHoverX(state.activeCoordinate.x);
                }}
                onMouseLeave={() => setHoverX(null)}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tickMargin={8} />
                <YAxis width={yAxisWidth} tickMargin={8} tickFormatter={(v) => formatValue(v as number)} />
                <Tooltip
                  content={<GlassTooltip formatValue={formatValue} />}
                  position={tooltipPosition}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 30 }}
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
          </div>

          {/*
            A real legend table below the chart, not Recharts' own
            <Legend> -- per direct feedback that the legend "looked messy."
            A responsive grid (2 columns on mobile, up to 4 on wider
            screens) rather than a fixed-column HTML `<table>` -- a fixed
            4 columns overflowed a 390px mobile card, truncating names
            like "Barry Snyder" to "Barry Sn". Each swatch is a short LINE
            segment (solid or dashed, matching that series' actual stroke),
            not a plain color dot -- per direct feedback that the legend
            "match the color but not the line style" for the dashed series
            past the 7-color palette cycle.
          */}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3 md:grid-cols-4">
            {seriesNames.map((name, i) => {
              const color = CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length];
              const isDashed = i >= CATEGORICAL_PALETTE.length;
              return (
                <div key={name} className="flex items-center gap-1.5 overflow-hidden">
                  <svg width="16" height="8" className="shrink-0" aria-hidden="true">
                    <line
                      x1="0" y1="4" x2="16" y2="4"
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray={isDashed ? "3 2" : undefined}
                    />
                  </svg>
                  <span className="truncate text-brand-dark/80">{name}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
