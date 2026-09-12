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
 *
 * `filters` (provider/service/sort) is a controlled prop, not local state --
 * the `ScheduleFilters` control itself is rendered by the parent
 * (`PatientsPage`) in the shared tab row (alongside the tab selector), the
 * same way the All Patients tab's Filters button is, rather than in its own
 * row here that used to push the whole schedule down an extra row.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, type ScheduleFilterParams } from "@/lib/api";
import { formatDate, scheduleFilterSuffix } from "@/lib/format";

import { ComingUpStrip } from "./ComingUpStrip";
import { ScheduleTable } from "./ScheduleTable";

const PAGE_SIZE = 100;

interface Props {
  filters: ScheduleFilterParams;
  onFiltersChange: (next: Partial<ScheduleFilterParams>) => void;
}

export function TodaysAppointmentsTable({ filters, onFiltersChange }: Props) {
  const [page, setPage] = useState(1);
  const { provider_id: providerId, service_id: serviceId, sort } = filters;

  // `filters` now comes from the parent (rendered in the shared tab row)
  // rather than being set locally, so resetting back to page 1 on a
  // filter change can't happen inline in an onChange handler anymore --
  // this effect does the equivalent whenever the filters actually change.
  useEffect(() => {
    setPage(1);
  }, [providerId, serviceId, sort]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", "today", page, providerId, serviceId, sort],
    queryFn: () => api.getTodaysAppointments({ page, page_size: PAGE_SIZE, provider_id: providerId, service_id: serviceId, sort }),
  });

  return (
    <div className="space-y-4">
      {data && <p className="text-sm text-brand-bg/70">Schedule for {formatDate(data.reference_date)}</p>}

      <ScheduleTable
        data={data}
        isLoading={isLoading}
        isError={isError}
        page={page}
        onPageChange={setPage}
        loadingMessage="Loading today's schedule…"
        errorMessage="Could not load today's schedule. Please try again."
        emptyMessage={`No appointments scheduled today${scheduleFilterSuffix(!!providerId, !!serviceId)}.`}
        contextKind="today"
        providerId={providerId}
        serviceId={serviceId}
        sort={sort}
        hasActiveFilters={!!providerId || !!serviceId}
        onClearFilters={() => onFiltersChange({ provider_id: undefined, service_id: undefined })}
      />

      <ComingUpStrip />
    </div>
  );
}
