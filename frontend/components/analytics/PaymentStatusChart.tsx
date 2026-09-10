"use client";

/**
 * Analytics Dashboard pie chart breaking down payments by status
 * (pending/paid/failed — independent of appointment status, per the
 * Payment model). Data comes from GET /analytics/payment-status via
 * `api.getPaymentStatus`.
 */

import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";
import { STATUS_COLORS } from "@/lib/chartColors";
import { formatLabel } from "@/lib/format";

/** Fetches and renders the payment-status breakdown as a pie chart. */
export function PaymentStatusChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "payment-status"],
    queryFn: api.getPaymentStatus,
  });

  if (isLoading) return <p className="text-brand-bg/70">Loading payment status…</p>;
  if (!data || data.length === 0) return <p className="text-brand-bg/70">No payment data yet.</p>;

  // `chartData` is a SEPARATE array from `data`, with formatLabel() applied
  // to `status` for display (e.g. "paid" -> "Paid"). It's what gets passed
  // to <Pie>, so slice labels/legend/tooltip show human-readable text.
  const chartData = data.map((entry) => ({ ...entry, status: formatLabel(entry.status) }));

  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <h2 className="mb-4 font-medium text-brand-dark">Payment Status</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} dataKey="count" nameKey="status" outerRadius={100} label>
            {/*
              IMPORTANT: this Cell mapping deliberately iterates the ORIGINAL
              raw `data` array (lowercase statuses), not `chartData` (which
              has formatLabel() applied). STATUS_COLORS (from lib/chartColors,
              shared with AppointmentStatusChart) is keyed by the raw
              lowercase strings ("paid", "pending", "failed"), so the lookup
              here must use `entry.status` from the unformatted array. If
              this were changed to map over `chartData` instead, every
              lookup would be against formatted text like "Paid" — which
              doesn't match any STATUS_COLORS key — and every slice would
              silently fall through to the gray fallback. Do not "simplify"
              this to a single shared array.
            */}
            {data.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#64748b"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
