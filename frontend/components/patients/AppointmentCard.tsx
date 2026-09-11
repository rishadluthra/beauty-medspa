/**
 * One appointment's card: its own status, every service performed on it (with
 * provider/time/price), and its payment if any. Shared by the Patient Detail page's
 * Appointment History list and the Appointment Detail page's single focused view, so
 * the two can never visually drift apart on how an appointment is actually presented.
 */

import type { AppointmentServiceItem, PaymentSummary } from "@/lib/types";
import { APPOINTMENT_STATUS_COLORS, PAYMENT_STATUS_COLORS } from "@/lib/chartColors";
import { formatCents, formatDate, formatLabel, formatTimeRange } from "@/lib/format";

/**
 * A status pill for either an appointment's own status or its payment's status. These
 * are two *different* fields that happen to share the same three-ish value shape (a
 * "good", "in-progress", and "bad" state), so they're deliberately given different
 * color maps (`APPOINTMENT_STATUS_COLORS` vs `PAYMENT_STATUS_COLORS`) AND different
 * visual weight — `variant="solid"` for the appointment's own status (the primary fact
 * about the card) and `variant="outline"` for its payment status (a secondary, related
 * fact) — so a "Confirmed" appointment sitting next to a "Paid" payment never reads as
 * the same badge repeated twice.
 */
export function StatusPill({
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

interface Props {
  status: string;
  /**
   * The actual scheduled visit date/time (earliest of its services' start times) — NOT
   * when the booking record was created, which can be a completely different,
   * unrelated date. Showing created_date here was a real bug: a patient's upcoming
   * visit could show as "no appointment" simply because the booking had been made
   * months earlier under a different date.
   */
  appointmentDate: string | null;
  services: AppointmentServiceItem[];
  payment: PaymentSummary | null;
  /**
   * The specific service row's own start time to bold among `services`, when the
   * appointment has more than one -- used by the Appointment Detail page so "the slot
   * you actually clicked" stays visually findable rather than lumped in with the rest
   * of the visit. Omitted (or not matching any service) renders every row the same way.
   */
  highlightedServiceStart?: string | null;
}

export function AppointmentCard({ status, appointmentDate, services, payment, highlightedServiceStart }: Props) {
  return (
    <div className="rounded-2xl border border-brand-gold/10 bg-brand-bg p-5 text-brand-dark shadow-lg shadow-brand-gold/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {appointmentDate ? formatDate(appointmentDate) : "Not yet scheduled"}
        </p>
        {/*
          Explicitly labeled "Status" — pending/confirmed/cancelled describes the
          appointment's own lifecycle (was it booked and will it happen), which is a
          different fact from whether it was paid for below, and needs the label to
          not be confused with it.
        */}
        <span className="flex items-center gap-1.5 text-xs text-brand-dark/50">
          Status
          <StatusPill status={status} colors={APPOINTMENT_STATUS_COLORS} variant="solid" />
        </span>
      </div>

      {/*
        A cancelled or brand-new appointment can have zero AppointmentService rows
        (nothing was ever performed on it), so this section is conditional rather than
        always rendering an empty list.
      */}
      {services.length > 0 && (
        <ul className="mt-3 divide-y divide-brand-dark/10 text-sm">
          {services.map((service, index) => {
            const isHighlighted = highlightedServiceStart != null && service.start === highlightedServiceStart;
            return (
              <li
                key={index}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg py-2 ${
                  isHighlighted ? "-mx-2 bg-brand-gold/10 px-2" : ""
                }`}
              >
                <div>
                  <p className="font-medium">{service.service_name}</p>
                  <p className="text-brand-dark/60">
                    {service.provider_name} · {formatTimeRange(service.start, service.end)}
                  </p>
                </div>
                <p className="text-brand-dark/80">{formatCents(service.price_cents)}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-brand-dark/10 pt-3 text-sm">
        <span className="text-brand-dark/60">Payment</span>
        {payment ? (
          <span className="flex items-center gap-2">
            {formatCents(payment.amount_cents)} · {formatLabel(payment.method)}
            <StatusPill status={payment.status} colors={PAYMENT_STATUS_COLORS} variant="outline" />
          </span>
        ) : (
          <span className="text-brand-dark/40">Unpaid</span>
        )}
      </div>
    </div>
  );
}
