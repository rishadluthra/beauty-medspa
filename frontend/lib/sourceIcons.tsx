/**
 * Small evocative glyphs for each patient acquisition `source`, shared by
 * `SourceBadge` (the All Patients table's icon+color+label pill) and the
 * "How Patients Find Us" pie chart's in-slice labels -- factored out here
 * so both places show literally the same icon per source rather than two
 * independently-drawn approximations that could drift apart.
 *
 * Generic (not brand-logo) glyphs, deliberately -- evocative of each
 * channel without reproducing a trademarked icon. Every icon uses
 * `stroke="currentColor"`/`fill="currentColor"` so a consumer can recolor
 * it (e.g. to match the source's own chart color) just by setting the
 * surrounding element's `color`.
 */

import type { ReactNode } from "react";

export const SOURCE_ICONS: Record<string, ReactNode> = {
  phone: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
      <path d="M3.5 2.5h2l1 3-1.5 1a8 8 0 0 0 4.5 4.5l1-1.5 3 1v2a1 1 0 0 1-1 1A10 10 0 0 1 2.5 3.5a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3 w-3">
      <rect x="2" y="2" width="12" height="12" rx="3.5" />
      <circle cx="8" cy="8" r="3" />
      <circle cx="11.5" cy="4.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
      <path d="M9 1.5h2c.15 1.3 1 2.3 2.5 2.5v2c-.95-.05-1.8-.35-2.5-.85V10a4 4 0 1 1-4-4c.17 0 .34 0 .5.03v2.07a2 2 0 1 0 1.5 1.9V1.5Z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="h-3 w-3">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M13.5 13.5 10.3 10.3" />
    </svg>
  ),
  website: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-3 w-3">
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c1.8 1.7 2.8 3.8 2.8 6s-1 4.3-2.8 6c-1.8-1.7-2.8-3.8-2.8-6S6.2 3.7 8 2Z" />
    </svg>
  ),
  in_person: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" className="h-3 w-3">
      <path d="M8 14.5s5-4.2 5-8a5 5 0 1 0-10 0c0 3.8 5 8 5 8Z" />
      <circle cx="8" cy="6.5" r="1.75" />
    </svg>
  ),
};

/** Returns the icon for a given raw `source` value, or `null` for an unrecognized one. */
export function getSourceIcon(source: string): ReactNode {
  return SOURCE_ICONS[source] ?? null;
}
