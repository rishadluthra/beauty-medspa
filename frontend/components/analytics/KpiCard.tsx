/**
 * Generic label/value stat tile. Purely presentational — no data fetching —
 * reused across the Analytics Dashboard's KPI row (e.g. total patients,
 * total revenue) to render each stat with consistent styling.
 */

interface Props {
  label: string;
  value: string;
}

/** Renders a single stat card: a small label above a large value. */
export function KpiCard({ label, value }: Props) {
  return (
    <div className="rounded-2xl border border-brand-dark/10 bg-white p-5 shadow-md">
      <p className="text-sm text-brand-sage">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-brand-dark">{value}</p>
    </div>
  );
}
