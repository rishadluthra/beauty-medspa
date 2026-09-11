"use client";

/**
 * Today's Appointments — the default view on the Patients page, and the
 * thing a front desk agent actually needs first each day: the full
 * schedule, one row per scheduled service (not per patient, since a
 * multi-service appointment occupies more than one time slot, possibly
 * with different providers), sorted by time. See the backend's
 * `list_todays_appointments` for exactly what "today" means against this
 * seed dataset.
 *
 * No follow-up/confirmation indicator here on purpose — `status` is shown
 * as a plain fact, not a call-to-action, since it doesn't reliably
 * correlate with whether an appointment actually needs attention (see
 * ATTENTION_TO_DETAIL.md's note on Appointment.status being uncorrelated
 * with time in this dataset).
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

import { ComingUpStrip } from "./ComingUpStrip";
import { ProviderFilterSelect } from "./ProviderFilterSelect";
import { ScheduleTable } from "./ScheduleTable";

const PAGE_SIZE = 100;

export function TodaysAppointmentsTable() {
  const [page, setPage] = useState(1);
  const [providerId, setProviderId] = useState<string | undefined>(undefined);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", "today", page, providerId],
    queryFn: () => api.getTodaysAppointments({ page, page_size: PAGE_SIZE, provider_id: providerId }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {data && <p className="text-sm text-brand-bg/70">Schedule for {formatDate(data.reference_date)}</p>}
        <ProviderFilterSelect
          value={providerId}
          onChange={(nextProviderId) => {
            setProviderId(nextProviderId);
            setPage(1);
          }}
        />
      </div>

      <ScheduleTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        page={page}
        onPageChange={setPage}
        loadingMessage="Loading today's schedule…"
        errorMessage="Could not load today's schedule. Please try again."
        emptyMessage={`No appointments scheduled today${providerId ? " for this provider" : ""}.`}
      />

      <ComingUpStrip />
    </div>
  );
}
