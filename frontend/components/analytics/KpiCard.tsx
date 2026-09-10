interface Props {
  label: string;
  value: string;
}

export function KpiCard({ label, value }: Props) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
