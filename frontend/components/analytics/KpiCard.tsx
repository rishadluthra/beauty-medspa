/**
 * Generic label/value stat tile. Purely presentational — no data fetching —
 * reused across the Analytics Dashboard's KPI row (e.g. total patients,
 * total revenue) to render each stat with consistent styling.
 */

interface Props {
  label: string;
  value: string;
}

/**
 * Renders a single stat card: a small label above a large value, both
 * centered. `text-xl` (not `text-2xl`) on the value is a deliberate size
 * -- a long formatted-currency value (e.g. a total-revenue figure in the
 * hundreds of thousands, "$647,382.50") needs to comfortably fit inside
 * the card at the narrowest width this renders at (the Analytics page's
 * multi-column KPI row), not just look good with short values like a
 * single patient's appointment count.
 */
export function KpiCard({ label, value }: Props) {
  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-center text-brand-dark shadow-lg shadow-brand-gold/10">
      <p className="text-sm text-brand-sage">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-brand-dark">{value}</p>
    </div>
  );
}
