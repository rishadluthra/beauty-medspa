"use client";

/**
 * Calendar view — a month grid of appointment density (how busy each day
 * is), so a front desk agent can spot a heavy day at a glance before
 * drilling into it, rather than paging through Today's/Upcoming
 * Appointments day by day. Clicking a day shows that day's full schedule
 * below the grid, reusing the same `ScheduleTable` as Today's Appointments.
 *
 * The grid opens on the dataset's reference "today" (see the backend's
 * `_get_upcoming_reference_now`) rather than the real current month, which
 * would be empty against this frozen seed dataset -- and that reference day
 * is highlighted on the grid as "Today" so it's clear which day that is.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDate, formatMonthLabel, parseISODate } from "@/lib/format";

import { ProviderFilterSelect } from "./ProviderFilterSelect";
import { ScheduleTable } from "./ScheduleTable";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_PAGE_SIZE = 100;

/** Shifts a "YYYY-MM" month string by `delta` months (can cross a year boundary either way). */
function shiftMonth(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const totalMonths = year * 12 + (monthNum - 1) + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

export function CalendarView() {
  // `undefined` until the first response tells us the dataset's actual
  // reference month/day -- only then do Prev/Next and day-selection have a
  // real starting point to move from.
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [dayPage, setDayPage] = useState(1);
  const [providerId, setProviderId] = useState<string | undefined>(undefined);

  const { data: calendar, isLoading: calendarLoading, isError: calendarError } = useQuery({
    queryKey: ["patients", "calendar", month],
    queryFn: () => api.getCalendarMonth({ month }),
  });

  // Seed the initial month/selected-day from the server's own default
  // reference date, exactly once -- afterward, Prev/Next and clicking a
  // day fully own these values.
  useEffect(() => {
    if (calendar && month === undefined) setMonth(calendar.month);
    if (calendar && selectedDate === undefined) setSelectedDate(calendar.reference_date);
  }, [calendar, month, selectedDate]);

  const { data: daySchedule, isLoading: dayLoading, isError: dayError } = useQuery({
    queryKey: ["patients", "day", selectedDate, dayPage, providerId],
    queryFn: () => api.getDaySchedule({ date: selectedDate as string, page: dayPage, page_size: DAY_PAGE_SIZE, provider_id: providerId }),
    enabled: selectedDate !== undefined,
  });

  const maxCount = calendar ? Math.max(1, ...calendar.days.map((d) => d.count)) : 1;
  const leadingBlanks = calendar ? parseISODate(`${calendar.month}-01`).getDay() : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 text-brand-dark shadow-lg shadow-brand-gold/10 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-brand-dark/60 transition-colors hover:bg-brand-dark/5 hover:text-brand-dark disabled:opacity-30"
            disabled={!month}
            onClick={() => month && setMonth(shiftMonth(month, -1))}
          >
            ‹ Prev
          </button>
          <h2 className="text-lg font-semibold">{month ? formatMonthLabel(month) : " "}</h2>
          <button
            type="button"
            aria-label="Next month"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-brand-dark/60 transition-colors hover:bg-brand-dark/5 hover:text-brand-dark disabled:opacity-30"
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
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-brand-dark/40 sm:gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: leadingBlanks }).map((_, index) => (
                <div key={`blank-${index}`} />
              ))}
              {calendar.days.map((day) => {
                const isSelected = day.date === selectedDate;
                const isReferenceToday = day.date === calendar.reference_date;
                const intensity = day.count > 0 ? 0.15 + 0.55 * (day.count / maxCount) : 0;
                return (
                  <button
                    key={day.date}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${formatDate(day.date)}, ${day.count} appointment${day.count === 1 ? "" : "s"}`}
                    onClick={() => {
                      setSelectedDate(day.date);
                      setDayPage(1);
                    }}
                    className={`flex flex-col items-center gap-1 rounded-lg py-2 text-sm transition-colors ${
                      isSelected ? "ring-2 ring-brand-gold" : "hover:bg-brand-dark/5"
                    } ${isReferenceToday ? "font-semibold" : ""}`}
                    style={{ backgroundColor: day.count > 0 ? `rgba(197, 163, 126, ${intensity})` : undefined }}
                  >
                    <span>{parseISODate(day.date).getDate()}</span>
                    {isReferenceToday && <span className="h-1 w-1 rounded-full bg-brand-gold" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedDate && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-brand-bg/70">Schedule for {formatDate(selectedDate)}</p>
            <ProviderFilterSelect
              value={providerId}
              onChange={(nextProviderId) => {
                setProviderId(nextProviderId);
                setDayPage(1);
              }}
            />
          </div>

          <ScheduleTable
            data={daySchedule}
            isLoading={dayLoading}
            isError={dayError}
            page={dayPage}
            onPageChange={setDayPage}
            loadingMessage="Loading that day's schedule…"
            errorMessage="Could not load that day's schedule. Please try again."
            emptyMessage={`No appointments scheduled${providerId ? " for this provider" : ""} on this day.`}
            contextKind="day"
            providerId={providerId}
            date={selectedDate}
          />
        </div>
      )}
    </div>
  );
}
