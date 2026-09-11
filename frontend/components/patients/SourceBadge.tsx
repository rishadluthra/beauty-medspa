/**
 * The patient "source" (marketing/acquisition channel) badge, shared by the
 * Patient Table, its mobile card view, and the Patient Detail page so the
 * icon+color+label treatment stays identical everywhere it appears.
 *
 * Pairs each badge with a small icon glyph (not just a color + word) so the
 * field reads as "how this patient found us" at a glance, rather than an
 * unlabeled colored pill whose meaning depends on already knowing the
 * column it came from.
 */

import type { ReactNode } from "react";

import { formatLabel } from "@/lib/format";
import { getSourceBadgeStyle } from "@/lib/sourceColors";

/** Generic (not brand-logo) glyphs — evocative of each channel without reproducing a trademarked icon. */
const SOURCE_ICONS: Record<string, ReactNode> = {
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

interface Props {
  source: string;
  /** Compact drops the icon and shrinks padding, for tight spaces like a table cell. Defaults to the fuller size. */
  size?: "default" | "compact";
}

/** An icon + label pill for a patient's acquisition source, in that channel's real brand color. */
export function SourceBadge({ source, size = "default" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium text-white ${
        size === "compact" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
      style={getSourceBadgeStyle(source)}
    >
      {SOURCE_ICONS[source]}
      {formatLabel(source)}
    </span>
  );
}
