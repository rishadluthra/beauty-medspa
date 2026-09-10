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
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
