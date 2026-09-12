"use client";

/**
 * Analytics Dashboard pie chart of patient counts by marketing source
 * (in_person/phone/instagram/tiktok/google/website). Data comes from
 * GET /analytics/patients-by-source via `api.getPatientsBySource`.
 *
 * Each slice's own count is drawn as a small frosted-glass chip INSIDE that
 * slice, holding the exact same icon `SourceBadge` uses for that source
 * (via `getSourceIcon`) plus the count itself, both tinted in that
 * source's own chart color -- not a plain white number, and not a
 * separate Legend below the chart. Per direct feedback: the previous
 * white in-slice numbers, the white 1px border Recharts draws between
 * slices by default, and the Legend all read as visual noise on top of a
 * chart whose whole point is "which color/source is which" -- putting the
 * source's own icon (already the established way this app identifies a
 * source, see the All Patients table) directly on its own slice answers
 * that without needing a separate key at all.
 */

import { cloneElement, isValidElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from "recharts";

import { api } from "@/lib/api";
import { formatLabel } from "@/lib/format";
import { getSourceChartColor } from "@/lib/sourceColors";
import { getSourceIcon } from "@/lib/sourceIcons";

const RADIAN = Math.PI / 180;
const LABEL_WIDTH = 60;
const LABEL_HEIGHT = 26;

/**
 * Renders one slice's data label as an HTML chip (via `foreignObject`, not
 * plain SVG `<text>`) so it can use real Tailwind classes -- specifically
 * `backdrop-blur`, which plain SVG has no equivalent for -- centered two-
 * thirds of the way from the pie's center to its outer edge, same
 * placement this chart's labels have always used.
 *
 * `payload` here is one row of `chartData` below, which deliberately keeps
 * the RAW `source` value (as `rawSource`) alongside the formatted display
 * name -- `getSourceChartColor`/`getSourceIcon` are both keyed by that raw
 * backend enum value (e.g. "in_person"), not the formatted label.
 */
function renderSourceGlassLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, value, payload } = props;
  const rawSource = (payload as { rawSource: string }).rawSource;
  const color = getSourceChartColor(rawSource);

  const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.65;
  const angle = -(Number(midAngle) || 0) * RADIAN;
  const x = Number(cx) + radius * Math.cos(angle);
  const y = Number(cy) + radius * Math.sin(angle);

  // The shared icon's own Tailwind size classes (`h-3 w-3`) don't take effect on an SVG
  // nested inside a `foreignObject` -- confirmed via a computed-style check showing
  // `width/height: 0px` despite the class being present in the DOM, a browser rendering
  // quirk specific to this SVG-inside-HTML-inside-SVG nesting. Explicit `width`/`height`
  // presentation attributes (set here via `cloneElement`, overriding the class) size it
  // correctly regardless of that quirk, since there's no competing CSS rule to lose to.
  const rawIcon = getSourceIcon(rawSource);
  const icon = isValidElement(rawIcon) ? cloneElement(rawIcon as React.ReactElement<{ className?: string; width?: number; height?: number }>, { className: undefined, width: 12, height: 12 }) : rawIcon;

  return (
    <foreignObject x={x - LABEL_WIDTH / 2} y={y - LABEL_HEIGHT / 2} width={LABEL_WIDTH} height={LABEL_HEIGHT} style={{ overflow: "visible" }}>
      <div
        className="flex h-full w-full items-center justify-center gap-1 rounded-full border border-white/60 bg-white/30 shadow-sm backdrop-blur-md"
        style={{ color }}
      >
        <span className="flex shrink-0 items-center">{icon}</span>
        <span className="text-xs font-semibold">{value}</span>
      </div>
    </foreignObject>
  );
}

/** Fetches and renders the patient-source breakdown as a pie chart. */
export function SourceBreakdownChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "patients-by-source"],
    queryFn: api.getPatientsBySource,
  });

  if (isLoading) return <p className="text-brand-bg/70">Loading source breakdown…</p>;
  if (!data || data.length === 0) return <p className="text-brand-bg/70">No patient source data yet.</p>;

  // `rawSource` keeps the original backend enum value (needed by
  // `getSourceChartColor`/`getSourceIcon` inside the label renderer and by
  // the `Cell` fill below) alongside `source`, which is reassigned to the
  // formatLabel()'d display name for the tooltip's own name column.
  const chartData = data.map((entry) => ({ ...entry, rawSource: entry.source, source: formatLabel(entry.source) }));

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <h2 className="mb-4 font-medium text-brand-dark">How Patients Find Us</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} dataKey="patient_count" nameKey="source" outerRadius={100} label={renderSourceGlassLabel} labelLine={false}>
            {/*
              `stroke="none"` removes Recharts' default white 1px border
              between slices -- per direct feedback that separator read as
              visual clutter, not a helpful boundary (the color change
              between adjacent slices already marks the boundary on its own).
            */}
            {data.map((entry, index) => (
              <Cell key={index} fill={getSourceChartColor(entry.source)} stroke="none" />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
