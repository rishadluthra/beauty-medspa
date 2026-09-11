/**
 * Shared "label inside the slice" renderer for this app's pie charts, used
 * with Recharts' `<Pie label={renderInsidePieLabel} labelLine={false}>`.
 *
 * Recharts' default `label` behavior draws each value OUTSIDE the pie with
 * a thin connector line back to its slice -- with six-plus slices packed
 * closely together (e.g. "How Patients Find Us"), those floating labels
 * and connector lines end up crowding each other and the legend below the
 * chart, reading as messy rather than informative. Placing the value
 * directly inside its own slice removes the connector lines entirely and
 * ties each number unambiguously to the wedge it belongs to.
 */

import type { PieLabelRenderProps } from "recharts";

const RADIAN = Math.PI / 180;

export function renderInsidePieLabel({ cx, cy, midAngle, innerRadius, outerRadius, value }: PieLabelRenderProps) {
  // Two-thirds of the way from the center to the outer edge -- centered
  // within the slice's own visual body, not right at its outer rim.
  const radius = innerRadius + (outerRadius - innerRadius) * 0.65;
  const angle = -(midAngle ?? 0) * RADIAN;
  const x = cx + radius * Math.cos(angle);
  const y = cy + radius * Math.sin(angle);

  return (
    <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600}>
      {value}
    </text>
  );
}
