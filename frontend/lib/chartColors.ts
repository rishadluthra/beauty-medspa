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
 * Appointment status and payment status are two *different* fields that
 * happen to share a "good/in-progress/bad" shape. Both appear side by side
 * on the same appointment card on the Patient Detail page — an
 * identically-colored "Confirmed" appointment badge next to a "Paid"
 * payment badge would read as one repeated fact instead of two distinct
 * ones. These two maps use entirely different hue families so the two
 * fields stay visually distinguishable independent of their text labels.
 */
export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  pending: BRAND.gold,
  confirmed: BRAND.sage,
  cancelled: BRAND.rust,
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: BRAND.khaki,
  paid: BRAND.navyTeal,
  failed: BRAND.rust,
};
