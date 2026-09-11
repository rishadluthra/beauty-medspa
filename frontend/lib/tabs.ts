/**
 * Front Desk page tabs -- shared between the tab bar itself
 * (`app/patients/page.tsx`) and the Patient/Appointment Detail pages'
 * "Back to ..." link, so the label a detail page's back button shows can
 * never drift out of sync with what the tab itself is actually called.
 */
export const TABS = [
  { key: "today", label: "Today's Appointments" },
  { key: "calendar", label: "Calendar" },
  { key: "walkin", label: "Walk-In Availability" },
  { key: "all", label: "All Patients" },
  { key: "rebooking", label: "Rebooking Opportunities" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/** Looks up a tab's display label by its key, e.g. for a "Back to X" link. Returns `undefined` for an unrecognized key. */
export function tabLabel(key: string): string | undefined {
  return TABS.find((t) => t.key === key)?.label;
}
