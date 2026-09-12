"use client";

/**
 * Calendar view — a compact, Apple-Calendar-style month grid: each day is
 * both a density heatmap (how busy that day is, by background intensity)
 * and a truncated preview of its earliest appointments (patient + time,
 * dot-colored by status), so a front desk agent can spot a heavy day and
 * see roughly who's on it before drilling in, without the grid growing
 * past a single laptop screen's height. Clicking a day switches the whole
 * view into a full Day View (not an inline list below the grid) with its
 * own Prev/Next-day navigation and a "Back to Calendar" link, reusing the
 * same `ScheduleTable` as Today's Appointments for the actual schedule.
 *
 * The month grid card uses the same opaque cream card treatment as every
 * other card in this app (`ScheduleTable`, `KpiCard`, etc.) -- a frosted-
 * glass version was tried first (matching the nav's own translucent look)
 * but read as washed-out and out of place, so it was reverted back to solid
 * `bg-brand-bg`. The Day View header is deliberately NOT a card at all --
 * an early version wrapped "Back to Calendar / date / Prev-Next Day" in one
 * and repeated the date again as plain text right below it ("Schedule for
 * Dec 3, 2025"), which was both a redundant second date and an unnecessary
 * box; it's now a plain control row (matching "Schedule for ..."'s own
 * previous transparent styling) with no repeated date text underneath.
 *
 * The grid opens on the dataset's reference "today" (see the backend's
 * `get_reference_now`) rather than the real current month, which would be
 * empty against this frozen seed dataset -- and that reference day is
 * highlighted on the grid as "Today," but landing on the page does NOT
 * auto-open its Day View; Month view is always the entry point, matching a
 * real calendar app instead of the previous auto-expanding-list behavior.
 *
 * `selectedDate`/`onSelectedDateChange` and `filters`/`onFiltersChange` are
 * controlled from `app/patients/page.tsx`, not owned locally, mirroring
 * exactly how `TodaysAppointmentsTable` is wired -- every other tab renders
 * its own filter button in the shared tab-bar row alongside "Today's
 * Appointments"/"Calendar"/etc. (see `page.tsx`), not in its own separate
 * row below the tabs. An earlier version kept `selectedDate`/`filters`
 * entirely local to this component and rendered its own `ScheduleFilters`
 * row underneath the Day View header, which put the Filters button in a
 * different place than every other tab and broke that shared layout
 * convention -- reported directly, fixed by lifting both up to the page.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, type ScheduleFilterParams } from "@/lib/api";
import { APPOINTMENT_STATUS_COLORS } from "@/lib/chartColors";
import { formatDate, formatDayHeading, formatMonthLabel, formatTime, parseISODate, scheduleFilterSuffix } from "@/lib/format";

import { ScheduleTable } from "./ScheduleTable";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_PAGE_SIZE = 100;

interface Props {
  selectedDate: string | undefined;
  onSelectedDateChange: (date: string | undefined) => void;
  filters: ScheduleFilterParams;
  onFiltersChange: (next: Partial<ScheduleFilterParams>) => void;
}

/** The app's standard opaque card treatment, matching `ScheduleTable`/`KpiCard`/etc. -- used for both of this component's own chrome pieces. */
const CALENDAR_CARD = "rounded-2xl border border-brand-gold/10 bg-brand-bg text-brand-dark shadow-lg shadow-brand-gold/10";

/** Shifts a "YYYY-MM" month string by `delta` months (can cross a year boundary either way). */
function shiftMonth(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const totalMonths = year * 12 + (monthNum - 1) + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

/** Shifts a "YYYY-MM-DD" date string by `delta` days, crossing month/year boundaries freely. */
function shiftDay(dateStr: string, delta: number): string {
  const date = parseISODate(dateStr);
  date.setDate(date.getDate() + delta);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CalendarView({ selectedDate, onSelectedDateChange, filters, onFiltersChange }: Props) {
  // `undefined` until the first response tells us the dataset's actual
  // reference month -- only then does Prev/Next month have a real starting
  // point to move from. `selectedDate` (a prop) stays `undefined` until a
  // day is actually clicked -- Month view, never Day View, is the landing
  // state.
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [dayPage, setDayPage] = useState(1);
  const { provider_id: providerId, service_id: serviceId, sort, sort_dir: sortDir } = filters;

  const { data: calendar, isLoading: calendarLoading, isError: calendarError } = useQuery({
    queryKey: ["patients", "calendar", month],
    queryFn: () => api.getCalendarMonth({ month }),
  });

  // Seed the initial month from the server's own default reference month,
  // exactly once -- afterward, Prev/Next month fully owns this value.
  useEffect(() => {
    if (calendar && month === undefined) setMonth(calendar.month);
  }, [calendar, month]);

  const { data: daySchedule, isLoading: dayLoading, isError: dayError } = useQuery({
    queryKey: ["patients", "day", selectedDate, dayPage, providerId, serviceId, sort, sortDir],
    queryFn: () => api.getDaySchedule({
      date: selectedDate as string, page: dayPage, page_size: DAY_PAGE_SIZE,
      provider_id: providerId, service_id: serviceId, sort, sort_dir: sortDir,
    }),
    enabled: selectedDate !== undefined,
  });

  /** Opens the Day View for `date`, keeping `month` in sync so "Back to Calendar" (or crossing a month boundary via Prev/Next Day) always lands on the right month. */
  function goToDay(date: string) {
    onSelectedDateChange(date);
    setMonth(date.slice(0, 7));
    setDayPage(1);
  }

  function handleSort(key: string) {
    onFiltersChange(sort === key ? { sort: key, sort_dir: sortDir === "asc" ? "desc" : "asc" } : { sort: key, sort_dir: "asc" });
    setDayPage(1);
  }

  if (selectedDate) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-full px-2.5 py-1 text-sm font-medium text-brand-bg/70 transition-colors hover:bg-brand-bg/10 hover:text-brand-bg"
            onClick={() => onSelectedDateChange(undefined)}
          >
            ‹ Back to Calendar
          </button>
          <h2 className="order-first w-full text-center text-base font-semibold text-brand-bg sm:order-none sm:w-auto sm:text-lg">
            {formatDayHeading(selectedDate)}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous day"
              className="rounded-full px-2.5 py-1 text-sm font-medium text-brand-bg/70 transition-colors hover:bg-brand-bg/10 hover:text-brand-bg"
              onClick={() => goToDay(shiftDay(selectedDate, -1))}
            >
              ‹ Prev Day
            </button>
            <button
              type="button"
              aria-label="Next day"
              className="rounded-full px-2.5 py-1 text-sm font-medium text-brand-bg/70 transition-colors hover:bg-brand-bg/10 hover:text-brand-bg"
              onClick={() => goToDay(shiftDay(selectedDate, 1))}
            >
              Next Day ›
            </button>
          </div>
        </div>

        <ScheduleTable
          data={daySchedule}
          isLoading={dayLoading}
          isError={dayError}
          page={dayPage}
          onPageChange={setDayPage}
          loadingMessage="Loading that day's schedule…"
          errorMessage="Could not load that day's schedule. Please try again."
          emptyMessage={`No appointments scheduled${scheduleFilterSuffix(!!providerId, !!serviceId)} on this day.`}
          contextKind="day"
          providerId={providerId}
          serviceId={serviceId}
          sort={sort}
          sortDir={sortDir}
          onSort={handleSort}
          date={selectedDate}
          hasActiveFilters={!!providerId || !!serviceId}
          onClearFilters={() => onFiltersChange({ provider_id: undefined, service_id: undefined })}
        />
      </div>
    );
  }

  const maxCount = calendar ? Math.max(1, ...calendar.days.map((d) => d.count)) : 1;
  const leadingBlanks = calendar ? parseISODate(`${calendar.month}-01`).getDay() : 0;

  return (
    <div className={`p-3 sm:p-4 ${CALENDAR_CARD}`}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className="rounded-full px-2.5 py-1 text-sm font-medium text-brand-dark/60 transition-colors hover:bg-brand-dark/10 hover:text-brand-dark disabled:opacity-30"
          disabled={!month}
          onClick={() => month && setMonth(shiftMonth(month, -1))}
        >
          ‹ Prev
        </button>
        <h2 className="text-base font-semibold sm:text-lg">{month ? formatMonthLabel(month) : " "}</h2>
        <button
          type="button"
          aria-label="Next month"
          className="rounded-full px-2.5 py-1 text-sm font-medium text-brand-dark/60 transition-colors hover:bg-brand-dark/10 hover:text-brand-dark disabled:opacity-30"
          disabled={!month}
          onClick={() => month && setMonth(shiftMonth(month, 1))}
        >
          Next ›
        </button>
      </div>

      {calendarLoading && <p className="text-brand-dark/60">Loading calendar…</p>}
      {calendarError && <p className="text-rust">Could not load the calendar. Please try again.</p>}

      {calendar && (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-brand-dark/40 sm:gap-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <div key={`blank-${index}`} />
            ))}
            {calendar.days.map((day) => {
              const isReferenceToday = day.date === calendar.reference_date;
              const intensity = day.count > 0 ? 0.15 + 0.55 * (day.count / maxCount) : 0;
              const hiddenCount = day.count - day.appointments.length;
              return (
                <button
                  key={day.date}
                  type="button"
                  aria-label={`${formatDate(day.date)}, ${day.count} appointment${day.count === 1 ? "" : "s"}`}
                  onClick={() => goToDay(day.date)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs transition-colors hover:bg-brand-dark/10 sm:min-h-[4.25rem] sm:items-stretch sm:justify-start sm:gap-0.5 sm:px-1 sm:py-1 sm:text-left sm:text-sm ${
                    isReferenceToday ? "font-semibold" : ""
                  }`}
                  style={{ backgroundColor: day.count > 0 ? `rgba(197, 163, 126, ${intensity})` : undefined }}
                >
                  <span className="flex items-center gap-1">
                    <span>{parseISODate(day.date).getDate()}</span>
                    {isReferenceToday && <span className="h-1 w-1 rounded-full bg-brand-gold" />}
                  </span>
                  {day.appointments.length > 0 && (
                    <div className="hidden w-full flex-col gap-px sm:flex">
                      {day.appointments.map((appt) => (
                        <span
                          key={appt.appointment_service_id}
                          className="flex min-w-0 items-center gap-1 rounded bg-brand-bg/70 px-1 text-[9px] font-normal leading-tight text-brand-dark/80"
                        >
                          <span
                            className="h-1 w-1 shrink-0 rounded-full"
                            style={{ backgroundColor: APPOINTMENT_STATUS_COLORS[appt.status] ?? "#64748b" }}
                          />
                          <span className="min-w-0 truncate">
                            {formatTime(appt.start)} {appt.patient_name.split(" ")[0]}
                          </span>
                        </span>
                      ))}
                      {hiddenCount > 0 && (
                        <span className="px-1 text-[9px] font-normal leading-tight text-brand-dark/50">+{hiddenCount} more</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
