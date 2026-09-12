/**
 * Shared styling for the small filter-control pills that sit in the
 * Front Desk page's tab row (the All Patients "Filters" button, the
 * Today's Appointments "All Providers" select) directly on the dark page
 * background. These two controls used to have two different visual
 * treatments -- "Filters" was a solid opaque cream button, "All Providers"
 * a transparent outlined pill -- which read as inconsistent once both sat
 * in the same row. Both now use this one shared class string instead of
 * copies that could drift apart again.
 */
export const FILTER_PILL_CLASSNAME =
  "flex items-center gap-2 rounded-full border border-brand-bg/20 bg-transparent px-4 py-1.5 text-sm text-brand-bg outline-none transition-colors hover:border-brand-gold hover:bg-brand-bg/10 hover:text-brand-gold focus:ring-2 focus:ring-brand-gold/50";

/**
 * Shared styling for a plain input/select field inside one of the dropdown "cards" that
 * `FILTER_PILL_CLASSNAME` buttons open (`PatientFilters`, `ScheduleFilters`) -- kept in
 * one place for the same reason `FILTER_PILL_CLASSNAME` itself is, so the two dropdown
 * cards' fields can't visually drift apart from each other over time.
 */
export const FILTER_FIELD_CLASSNAME =
  "rounded-lg border border-brand-dark/10 bg-brand-dark/5 px-3 py-2 text-sm text-brand-dark outline-none transition-colors focus:ring-2 focus:ring-brand-gold/50 placeholder:text-brand-dark/40";
