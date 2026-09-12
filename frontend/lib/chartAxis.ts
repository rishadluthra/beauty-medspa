/**
 * Estimates the pixel width a numeric/category axis needs to show its
 * longest tick label without clipping, from the actual labels the data
 * will produce -- not a fixed guess.
 *
 * A fixed guess is exactly what caused real Y-axis labels to get clipped
 * in production across nearly every chart on the Analytics page: a
 * hand-picked width of 72px for Revenue's currency axis still clipped the
 * "$" off "$600,000" once real data pushed past the guessed range; 40px
 * for the Demographics gender/age counts still clipped the leading digit
 * off "2,800"; and a shared 140px category-label width still clipped the
 * leading "R" off "RF Skin Tightening" in the Top Services chart. Every
 * one of those was a plausible-looking number that simply wasn't checked
 * against the actual longest real value. Computing it from the real
 * labels instead makes this correct by construction and automatically
 * right-sized if the underlying data changes.
 */
export function estimateAxisWidth(labels: string[], charWidthPx = 8, paddingPx = 28): number {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  return Math.round(longest * charWidthPx + paddingPx);
}

/**
 * Left-aligns a horizontal bar chart's category `<YAxis>` tick labels,
 * instead of Recharts' default: for a left-side axis, Recharts
 * right-aligns tick text (`textAnchor="end"`), anchored at a fixed point
 * near the axis line, with the text extending LEFTWARD from there. That
 * produces a ragged left edge (each label starts wherever its own length
 * happens to put it) and, worse, means an underestimated axis `width`
 * clips label text off the LEFT side of the chart entirely (it renders at
 * a negative x position, off-canvas) -- confirmed live: "Anthony Freeman"
 * rendered as "nthony Freeman" in production even after `estimateAxisWidth`
 * sized the axis from the real data.
 *
 * Passed as `<YAxis tick={LEFT_ALIGNED_CATEGORY_TICK}>`. Recharts merges a
 * plain-object `tick` prop directly onto the rendered tick `<text>`
 * element (confirmed by reading Recharts' own CartesianAxis source, not
 * guessed) -- `x: 4` overrides the per-tick computed x-coordinate with one
 * fixed small left inset for every label, and `textAnchor: "start"` makes
 * each label grow RIGHTWARD from that shared point instead of leftward
 * from the axis line. Every label now shares one common left edge (the
 * actual "left-aligned" look), and even a label wider than the reserved
 * axis width can only ever overlap rightward into the plot area -- a much
 * smaller, still-fully-visible cosmetic issue, never an invisible,
 * off-canvas clip again.
 */
export const LEFT_ALIGNED_CATEGORY_TICK = { textAnchor: "start" as const, x: 4 };

const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Formats a "YYYY-MM" period key (the shape every analytics time-series
 * endpoint returns, e.g. RevenuePoint.period) as a short tick label like
 * "Dec '24" -- Recharts' default of rendering the raw "2024-12" string for
 * every point produced an unreadable wall of 10-character labels across a
 * full year of months (confirmed in production: 12 ticks reading
 * "2024-12" through "2025-11" overlapping into an illegible strip).
 */
export function formatPeriodTick(period: string): string {
  const [year, month] = period.split("-");
  const monthIndex = Number(month) - 1;
  const abbrev = MONTH_ABBREVIATIONS[monthIndex] ?? month;
  return `${abbrev} '${year.slice(2)}`;
}

/**
 * The deliberate desktop-width decluttering target from the original
 * fixed-`maxTicks` version of this function -- a full year of monthly
 * ticks (12) all rendering is technically non-overlapping on a wide
 * desktop chart, but still reads as busier than a clean ~7-tick axis.
 * Kept as an upper bound even though tick count is now width-aware (see
 * `periodAxisInterval`), so a wide chart still gets the same intentionally
 * sparse look it always has -- only a chart too narrow to fit even this
 * many gets pushed below it.
 */
const DEFAULT_MAX_TICKS = 7;

/**
 * Picks a Recharts `<XAxis interval>` value so a monthly period axis shows
 * only as many labels as `chartWidth` can actually fit side by side (down
 * to `DEFAULT_MAX_TICKS` on a wide chart) -- an earlier version hard-coded
 * `maxTicks = 7` regardless of the chart's real rendered width, which
 * looked fine on a desktop-width chart but overlapped into an illegible
 * mess on a phone-width one (confirmed live: a ~350px-wide mobile chart
 * tried to cram the same 7 "Mon 'YY" labels a ~900px desktop chart shows,
 * at roughly half the pixels each). This is the exact "fixed guess instead
 * of a real measurement" mistake `estimateAxisWidth`'s own comment already
 * warns about, just on the x-axis's tick *count* rather than the y-axis's
 * tick *width*. `tickWidthPx` is the same per-character estimation
 * approach as `estimateAxisWidth` (8px/char), sized for a "Mon 'YY" label
 * (7 characters, ~56px at 8px/char) plus real breathing room -- ticks are
 * center-anchored, so spacing adjacent centers exactly one label-width
 * apart (56px) only guarantees their edges don't overlap, not that they
 * don't touch: confirmed live at 70px, mobile ticks read "Dec '24Mar '25"
 * with zero gap between them, each label fully legible but butted up
 * against its neighbor. 90px leaves a visible gap.
 */
export function periodAxisInterval(pointCount: number, chartWidth: number, tickWidthPx = 90): number {
  const widthLimitedTicks = Math.max(2, Math.floor(chartWidth / tickWidthPx));
  const maxTicks = Math.min(DEFAULT_MAX_TICKS, widthLimitedTicks);
  if (pointCount <= maxTicks) return 0;
  return Math.ceil(pointCount / maxTicks) - 1;
}
