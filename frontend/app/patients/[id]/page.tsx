"use client";

/**
 * Patient Detail page (`/patients/[id]`) — the drill-down from a Patient
 * Table row. The table only shows the most relevant columns at a glance;
 * everything else the data model actually holds for a patient (address,
 * full appointment history, the services performed on each appointment
 * with their provider/time/price, and the payment tied to each one) lives
 * here instead. Uses the same frosted cream-card-on-dark-page styling as
 * every other page.
 */

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { KpiCard } from "@/components/analytics/KpiCard";
import { SourceBadge } from "@/components/patients/SourceBadge";
import { api } from "@/lib/api";
import { APPOINTMENT_STATUS_COLORS, PAYMENT_STATUS_COLORS } from "@/lib/chartColors";
import { calculateAge, formatCents, formatDate, formatLabel, formatPhone, formatTimeRange } from "@/lib/format";

/**
 * A status pill for either an appointment's own status or its payment's
 * status. These are two *different* fields that happen to share the same
 * three-ish value shape (a "good", "in-progress", and "bad" state), so
 * they're deliberately given different color maps (`APPOINTMENT_STATUS_COLORS`
 * vs `PAYMENT_STATUS_COLORS`) AND different visual weight — `variant="solid"`
 * for the appointment's own status (the primary fact about the card) and
 * `variant="outline"` for its payment status (a secondary, related fact) —
 * so a "Confirmed" appointment sitting next to a "Paid" payment never reads
 * as the same badge repeated twice.
 */
function StatusPill({
  status,
  colors,
  variant = "solid",
}: {
  status: string;
  colors: Record<string, string>;
  variant?: "solid" | "outline";
}) {
  const color = colors[status] ?? "#64748b";
  if (variant === "outline") {
    return (
      <span className="inline-block rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: color, color }}>
        {formatLabel(status)}
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ backgroundColor: color }}>
      {formatLabel(status)}
    </span>
  );
}

/** One icon+text fact in the header's contact-info row (phone, email, address, joined date). */
function InfoItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-brand-dark/70">
      {icon}
      {children}
    </span>
  );
}

const PhoneIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-brand-dark/40">
    <path d="M3.5 2.5h2l1 3-1.5 1a8 8 0 0 0 4.5 4.5l1-1.5 3 1v2a1 1 0 0 1-1 1A10 10 0 0 1 2.5 3.5a1 1 0 0 1 1-1Z" />
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-brand-dark/40">
    <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
    <path d="m2.5 4 5.5 4.5L13.5 4" />
  </svg>
);
const PinIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-brand-dark/40">
    <path d="M8 14.5s5-4.2 5-8a5 5 0 1 0-10 0c0 3.8 5 8 5 8Z" />
    <circle cx="8" cy="6.5" r="1.75" />
  </svg>
);
const CalendarIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-brand-dark/40">
    <rect x="2.5" y="3" width="11" height="10.5" rx="1.5" />
    <path d="M2.5 6.5h11M5.5 1.5v3M10.5 1.5v3" />
  </svg>
);

/** Top-level route component for `/patients/[id]`. */
export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = params.id;

  // The URL's query string IS the list context (see `patientDetailHref`, which every
  // source list builds its link-out with) -- forwarded as-is to the API so Previous/Next
  // are scoped to whichever list the agent actually navigated from, and re-appended to
  // the Previous/Next links below so hopping through several patients in a row keeps
  // walking that same list instead of reverting to the global default after one hop.
  const contextQuery = searchParams.toString();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patient", patientId, contextQuery],
    queryFn: () => api.getPatientDetail(patientId, Object.fromEntries(searchParams.entries())),
  });

  const initials = data ? `${data.patient.first_name[0]}${data.patient.last_name[0]}`.toUpperCase() : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1 text-sm text-brand-bg/70 transition-colors hover:text-brand-gold-dark"
        >
          ← Back to Front Desk
        </Link>

        {/*
          Previous/Next walk whichever source list the agent navigated in
          from (see `contextQuery` above) -- Today's schedule order,
          Rebooking's most-recent-visit-first order, or All Patients' own
          active filter/sort -- falling back to the old fixed
          (last_name, first_name) order when there's no list context at
          all (a direct link, a global-search result). Computed
          server-side in the same request as the rest of this page's data
          (no extra round-trip). The SAME query string is re-appended to
          the pushed URL below, so clicking through several patients in a
          row keeps walking that same list instead of reverting to the
          global default after one hop. Disabled rather than hidden at
          either end of that ordering, so the control stays in a
          predictable place instead of the layout shifting.
        */}
        {data && (
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              disabled={!data.previous_patient_id}
              onClick={() =>
                data.previous_patient_id &&
                router.push(`/patients/${data.previous_patient_id}${contextQuery ? `?${contextQuery}` : ""}`)
              }
              className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={!data.next_patient_id}
              onClick={() =>
                data.next_patient_id &&
                router.push(`/patients/${data.next_patient_id}${contextQuery ? `?${contextQuery}` : ""}`)
              }
              className="rounded-full border border-brand-bg/20 px-4 py-1.5 text-brand-bg transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold disabled:opacity-40 disabled:hover:border-brand-bg/20 disabled:hover:bg-transparent disabled:hover:text-brand-bg"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-brand-bg/70">Loading patient…</p>}
      {isError && <p className="text-coral">Could not load this patient. Please try again.</p>}
      {!isLoading && !isError && data === null && <p className="text-coral">Patient not found.</p>}

      {data && (
        <>
          <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-brand-dark shadow-lg shadow-brand-gold/10">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark text-lg font-semibold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-2xl font-semibold">
                  {data.patient.first_name} {data.patient.last_name}
                </h1>
                <p className="text-sm text-brand-dark/60">
                  {calculateAge(data.patient.date_of_birth)} years old · {formatLabel(data.patient.gender)}
                </p>
              </div>
              {/*
                A bare colored pill reading e.g. "Instagram" doesn't say
                what field it is unless you already know — the small
                "Source" caption above it (mirroring `KpiCard`'s
                label-above-value pattern) makes it self-explanatory: this
                is how the patient found the practice.
              */}
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dark/40">Source</p>
                <div className="mt-1"><SourceBadge source={data.patient.source} /></div>
              </div>
            </div>

            {/*
              An icon-led row that wraps naturally (each item only takes
              the width its own text needs) reads as tightly packed at any
              card width, instead of a sparse two-column grid that leaves
              a wide empty gap on the right when the card is wider than
              four short lines of text need.
            */}
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-brand-dark/10 pt-4 text-sm">
              <InfoItem icon={<PhoneIcon />}>{formatPhone(data.patient.phone)}</InfoItem>
              <InfoItem icon={<MailIcon />}>{data.patient.email}</InfoItem>
              <InfoItem icon={<PinIcon />}>{data.patient.address}</InfoItem>
              <InfoItem icon={<CalendarIcon />}>Joined {formatDate(data.patient.created_date)}</InfoItem>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label="Appointments" value={String(data.patient.appointment_count)} />
            <KpiCard label="Total Spent" value={formatCents(data.patient.total_spent_cents)} />
            <KpiCard label="Last Appointment" value={formatDate(data.patient.last_appointment_date)} />
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-brand-bg">Appointment History</h2>

            {data.appointments.length === 0 && <p className="text-brand-bg/70">No appointments on record.</p>}

            {data.appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/*
                    `appointment_date` (the actual scheduled visit time,
                    derived from its services) is what's shown here — NOT
                    `created_date` (when the booking record was entered,
                    which can be a completely different, unrelated date).
                    Showing created_date here was a real bug: a patient's
                    upcoming visit could show as "no appointment" on this
                    page simply because the booking had been made months
                    earlier under a different date.
                  */}
                  <p className="font-medium">
                    {appointment.appointment_date ? formatDate(appointment.appointment_date) : "Not yet scheduled"}
                  </p>
                  {/*
                    Explicitly labeled "Status" — pending/confirmed/cancelled
                    describes the appointment's own lifecycle (was it booked
                    and will it happen), which is a different fact from
                    whether it was paid for below, and needs the label to
                    not be confused with it.
                  */}
                  <span className="flex items-center gap-1.5 text-xs text-brand-dark/50">
                    Status
                    <StatusPill status={appointment.status} colors={APPOINTMENT_STATUS_COLORS} variant="solid" />
                  </span>
                </div>

                {/*
                  A cancelled or brand-new appointment can have zero
                  AppointmentService rows (nothing was ever performed on
                  it), so this section is conditional rather than always
                  rendering an empty list.
                */}
                {appointment.services.length > 0 && (
                  <ul className="mt-3 divide-y divide-brand-dark/10 text-sm">
                    {appointment.services.map((service, index) => (
                      <li key={index} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <div>
                          <p className="font-medium">{service.service_name}</p>
                          <p className="text-brand-dark/60">
                            {service.provider_name} · {formatTimeRange(service.start, service.end)}
                          </p>
                        </div>
                        <p className="text-brand-dark/80">{formatCents(service.price_cents)}</p>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-brand-dark/10 pt-3 text-sm">
                  <span className="text-brand-dark/60">Payment</span>
                  {appointment.payment ? (
                    <span className="flex items-center gap-2">
                      {formatCents(appointment.payment.amount_cents)} · {formatLabel(appointment.payment.method)}
                      <StatusPill status={appointment.payment.status} colors={PAYMENT_STATUS_COLORS} variant="outline" />
                    </span>
                  ) : (
                    <span className="text-brand-dark/40">Unpaid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
