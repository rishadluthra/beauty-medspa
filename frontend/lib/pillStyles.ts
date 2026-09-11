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
