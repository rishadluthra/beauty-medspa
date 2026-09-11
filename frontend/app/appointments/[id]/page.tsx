"use client";

/**
 * Appointment Detail page (`/appointments/[id]`) — the drill-down from a Today's
 * Appointments / Calendar schedule row. Those schedules are one row per scheduled
 * *service* (a multi-service visit occupies several distinct time slots, possibly with
 * different providers), so clicking a row is naturally "tell me about this
 * appointment," not "tell me about this patient" -- unlike the Patient Detail page
 * (`/patients/[id]`), which All Patients/Rebooking Opportunities rows still drill into.
 * Routing schedule rows into that generic, all-history page instead (the original
 * design) meant Next/Prev could land on the exact same patient twice in a row -- correct
 * in ranking terms, but confusing as a destination, since the page shown looked
 * identical rather than like "here's their next visit today." This page shows the
 * appointment itself, with the patient reduced to a compact summary strip.
 */

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { AppointmentCard } from "@/components/patients/AppointmentCard";
import { api } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import { tabLabel } from "@/lib/tabs";

const TAB_FOR_CONTEXT: Record<string, string> = { today: "today", day: "calendar" };

/** Top-level route component for `/appointments/[id]`. */
export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = params.id;

  const contextQuery = searchParams.toString();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["appointment", appointmentId, contextQuery],
    queryFn: () => api.getAppointmentDetail(appointmentId, Object.fromEntries(searchParams.entries())),
  });

  /**
   * Builds a Previous/Next destination: the same query string this page was loaded
   * with, but with `service_id` swapped for the response's own neighboring row id.
   * Reusing the OLD `service_id` on every hop would pin every future request to the
   * first row clicked forever, so a second "Next" click would re-rank from that same
   * stale position and resolve right back to the appointment already on screen --
   * pushing to a URL that's already loaded, which does nothing. (This is exactly the
   * bug the Patient Detail page's own `ctx=today`/`"day"` Previous/Next used to have,
   * before that behavior moved here.)
   */
  const hrefFor = (targetAppointmentId: string, serviceId: number | null): string => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (serviceId !== null) nextParams.set("service_id", String(serviceId));
    const qs = nextParams.toString();
    return `/appointments/${targetAppointmentId}${qs ? `?${qs}` : ""}`;
  };

  // The back link returns to the Today's Appointments or Calendar tab this schedule
  // row was actually clicked from, labeled with that same tab's own name (`tabLabel`)
  // -- same mechanism as the Patient Detail page's own back link, just mapping this
  // page's own `ctx` values (there's no "all" here; only a schedule row reaches this
  // page at all).
  const contextKind = searchParams.get("ctx");
  const backTab = contextKind ? TAB_FOR_CONTEXT[contextKind] : undefined;
  const backHref = backTab ? `/patients?tab=${backTab}` : "/patients";
  const backLabel = (backTab && tabLabel(backTab)) || "Front Desk";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-brand-bg/70 transition-colors hover:text-brand-gold-dark"
        >
          ← Back to {backLabel}
        </Link>

        {/*
          Previous/Next walk the same schedule window (Today's Appointments, or the
          specific Calendar day) this appointment was navigated from, not always the
          same appointment -- see `hrefFor` above for why `service_id` has to be
          swapped on every hop rather than just re-appended.
        */}
        {data && (
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              disabled={!data.previous_appointment_id}
              onClick={() =>
                data.previous_appointment_id &&
                router.push(hrefFor(data.previous_appointment_id, data.previous_service_id))
              }
              className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={!data.next_appointment_id}
              onClick={() =>
                data.next_appointment_id &&
                router.push(hrefFor(data.next_appointment_id, data.next_service_id))
              }
              className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-brand-bg/70">Loading appointment…</p>}
      {isError && <p className="text-coral">Could not load this appointment. Please try again.</p>}
      {!isLoading && !isError && data === null && <p className="text-coral">Appointment not found.</p>}

      {data && (
        <>
          {/*
            A compact patient summary, not the full profile -- this page is about the
            appointment. "View full profile" is a deliberate drill-in action (no list
            context to preserve), so it links plainly to /patients/{id}.
          */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
            <div>
              <h1 className="text-xl font-semibold">{data.patient.first_name} {data.patient.last_name}</h1>
              <p className="mt-1 text-sm text-brand-dark/60">
                {formatPhone(data.patient.phone)} · {data.patient.email}
              </p>
            </div>
            <Link
              href={`/patients/${data.patient.id}`}
              className="shrink-0 rounded-full border border-brand-dark/20 px-4 py-1.5 text-sm text-brand-dark/70 transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
            >
              View full profile →
            </Link>
          </div>

          <AppointmentCard
            status={data.status}
            appointmentDate={data.appointment_date}
            services={data.services}
            payment={data.payment}
            highlightedServiceStart={data.highlighted_service_start}
          />
        </>
      )}
    </div>
  );
}
