/**
 * Chart color palette, derived from the same brand colors used across the
 * rest of the UI (see `tailwind.config.ts`'s `brand` colors and
 * ATTENTION_TO_DETAIL.md for where they came from) rather than the
 * generic, unrelated teal/purple/pink/lime set charts started with.
 *
 * Keeping charts on this palette (instead of arbitrary saturated colors)
 * is what makes the analytics page read as one cohesive design instead of
 * a grab-bag of default chart-library colors.
 */
export const BRAND = {
  gold: "#c5a37e",
  goldDark: "#b08e68",
  sage: "#4a5d4e",
  navyTeal: "#144761",
  rust: "#9a3412",
  rose: "#a8677a",
  khaki: "#8a8360",
} as const;

/** Ordered palette for charts with several categorical slices/bars (e.g. patient source). */
export const CATEGORICAL_PALETTE = [
  BRAND.gold,
  BRAND.sage,
  BRAND.navyTeal,
  BRAND.rust,
  BRAND.rose,
  BRAND.khaki,
];

/**
 * Shared status-color convention used by both status charts (appointment
 * status, payment status): a "settled/positive" state (confirmed/paid) in
 * sage, an "in-progress" state (pending) in gold, and a "needs attention"
 * state (cancelled/failed) in a muted rust — kept intentionally muted
 * rather than a harsh bright red, to stay within the site's warm, calm
 * palette while still reading as distinct from the positive/neutral colors.
 */
export const STATUS_COLORS: Record<string, string> = {
  confirmed: BRAND.sage,
  paid: BRAND.sage,
  pending: BRAND.gold,
  cancelled: BRAND.rust,
  failed: BRAND.rust,
};
