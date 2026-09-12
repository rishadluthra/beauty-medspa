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

import { formatLabel } from "@/lib/format";
import { getSourceBadgeStyle } from "@/lib/sourceColors";
import { SOURCE_ICONS } from "@/lib/sourceIcons";

interface Props {
  source: string;
  /** Compact drops the icon and shrinks padding, for tight spaces like a table cell. Defaults to the fuller size. */
  size?: "default" | "compact";
}

/**
 * An icon + label pill for a patient's acquisition source, in that
 * channel's real brand color. Every source renders at the *same* fixed
 * width (`justify-center` + a set `w-*`, not padding around whatever the
 * label's natural width is) so "Google" and "In Person" badges line up
 * identically in a column/row together instead of each being sized to its
 * own text — the width is set to comfortably fit the longest label
 * ("In Person"/"Instagram") at each size.
 */
export function SourceBadge({ source, size = "default" }: Props) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full font-medium text-white ${
        size === "compact" ? "w-24 px-2 py-0.5 text-[11px]" : "w-28 px-2.5 py-1 text-xs"
      }`}
      style={getSourceBadgeStyle(source)}
    >
      {SOURCE_ICONS[source]}
      {formatLabel(source)}
    </span>
  );
}
