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
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { KpiCard } from "@/components/analytics/KpiCard";
import { api } from "@/lib/api";
import { STATUS_COLORS } from "@/lib/chartColors";
import { calculateAge, formatCents, formatDate, formatLabel, formatPhone, formatTimeRange } from "@/lib/format";
import { getSourceBadgeStyle } from "@/lib/sourceColors";

/** Small colored pill for an appointment or payment status, reusing the analytics charts' status palette. */
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-xs font-medium text-white"
      style={{ backgroundColor: STATUS_COLORS[status] ?? "#64748b" }}
    >
      {formatLabel(status)}
    </span>
  );
}

/** Top-level route component for `/patients/[id]`. */
export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => api.getPatientDetail(patientId),
  });

  return (
    <div className="space-y-6">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1 text-sm text-brand-bg/70 transition-colors hover:text-brand-gold-dark"
      >
        ← Back to Patients
      </Link>

      {isLoading && <p className="text-brand-bg/70">Loading patient…</p>}
      {isError && <p className="text-coral">Could not load this patient. Please try again.</p>}
      {!isLoading && !isError && data === null && <p className="text-coral">Patient not found.</p>}

      {data && (
        <>
          <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-6 text-brand-dark shadow-lg shadow-brand-gold/10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">
                  {data.patient.first_name} {data.patient.last_name}
                </h1>
                <p className="mt-1 text-sm text-brand-dark/60">
                  {calculateAge(data.patient.date_of_birth)} years old · {formatLabel(data.patient.gender)}
                </p>
              </div>
              <span
                className="inline-block rounded-full px-3 py-1 text-xs font-medium text-white"
                style={getSourceBadgeStyle(data.patient.source)}
              >
                {formatLabel(data.patient.source)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-brand-dark/80 sm:grid-cols-2">
              <p><span className="text-brand-dark/50">Phone:</span> {formatPhone(data.patient.phone)}</p>
              <p><span className="text-brand-dark/50">Email:</span> {data.patient.email}</p>
              <p><span className="text-brand-dark/50">Address:</span> {data.patient.address}</p>
              <p><span className="text-brand-dark/50">Joined:</span> {formatDate(data.patient.created_date)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label="Visits" value={String(data.patient.appointment_count)} />
            <KpiCard label="Total Spent" value={formatCents(data.patient.total_spent_cents)} />
            <KpiCard label="Last Visit" value={formatDate(data.patient.last_appointment_date)} />
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
                  <p className="font-medium">{formatDate(appointment.created_date)}</p>
                  <StatusBadge status={appointment.status} />
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
                      <StatusBadge status={appointment.payment.status} />
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
