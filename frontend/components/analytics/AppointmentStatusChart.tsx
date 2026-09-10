"use client";

/**
 * Analytics Dashboard pie chart breaking down appointments by status
 * (pending/confirmed/cancelled, per the Appointment model). Data comes
 * from GET /analytics/appointment-status via `api.getAppointmentStatus`.
 */

import { useQuery } from "@tanstack/react-query";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";
import { formatLabel } from "@/lib/format";

// Keyed by the RAW lowercase status strings the API returns (matches
// Appointment.status in models.py), not by any formatted/display text.
const STATUS_COLORS: Record<string, string> = {
  confirmed: "#0f766e",
  pending: "#d97706",
  cancelled: "#dc2626",
};

/** Fetches and renders the appointment-status breakdown as a pie chart. */
export function AppointmentStatusChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "appointment-status"],
    queryFn: api.getAppointmentStatus,
  });

  if (isLoading) return <p className="text-slate-500">Loading appointment status…</p>;
  if (!data || data.length === 0) return <p className="text-slate-500">No appointment data yet.</p>;

  // `chartData` is a SEPARATE array from `data`, with formatLabel() applied
  // to `status` for display (e.g. "confirmed" -> "Confirmed"). It's what
  // gets passed to <Pie>, so slice labels/legend/tooltip show human-readable
  // text.
  const chartData = data.map((entry) => ({ ...entry, status: formatLabel(entry.status) }));

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-4 font-medium">Appointment Status</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} dataKey="count" nameKey="status" outerRadius={100} label>
            {/*
              IMPORTANT: this Cell mapping deliberately iterates the ORIGINAL
              raw `data` array (lowercase statuses), not `chartData` (which
              has formatLabel() applied). STATUS_COLORS is keyed by the raw
              lowercase strings ("confirmed", "pending", "cancelled"), so the
              lookup here must use `entry.status` from the unformatted array.
              If this were changed to map over `chartData` instead, every
              lookup would be against formatted text like "Confirmed" —
              which doesn't match any STATUS_COLORS key — and every slice
              would silently fall through to the gray fallback (#64748b).
              Do not "simplify" this to a single shared array.
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
