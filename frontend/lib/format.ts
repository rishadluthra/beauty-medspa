/**
 * Display-formatting helpers shared across the frontend.
 *
 * These are pure, presentation-only functions — they never mutate the
 * underlying data (money stays integer cents, dates stay ISO strings, etc.
 * everywhere outside of this file); they just turn raw API values into the
 * strings shown in the UI.
 */

/**
 * Converts integer cents to a localized USD currency string (e.g. `1050` -> `"$10.50"`).
 *
 * This is the single place cents-to-dollars conversion happens for display —
 * the backend and every TypeScript type keep money as integer cents
 * everywhere else, so callers should never do this division themselves.
 */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Formats an ISO date string for display, or `"—"` for a null/missing value
 * (e.g. a patient with no appointments yet).
 *
 * Deliberately uses an explicit `{ year: "numeric", month: "short", day: "numeric" }`
 * format instead of a bare `toLocaleDateString()` call. The bare version
 * produces inconsistent digit widths depending on the date (e.g. `5/29/2025`
 * vs `12/1/2024`), which looks ragged in a table column; the explicit format
 * (`May 29, 2025`) is unambiguous and visually consistent regardless of the
 * date's numeric width.
 */
export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Formats an ISO datetime string as a date *and* time on one line (e.g.
 * `"Jan 12, 2026 · 8:15 AM"`) — used where the time-of-day itself matters
 * (an upcoming appointment slot), unlike `formatDate`, which only ever
 * shows a date.
 */
export function formatDateTime(value: string): string {
  const date = new Date(value);
  const datePart = date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

/**
 * Turns a snake_case enum-ish value into a human-readable, title-cased label
 * (e.g. `"in_person"` -> `"In Person"`).
 *
 * This replaces an earlier approach that applied a CSS `capitalize` class
 * directly to raw values. That was actually a bug: CSS `text-transform:
 * capitalize` only capitalizes letters following whitespace, so it doesn't
 * treat underscores as word boundaries — `in_person` rendered as `In_person`,
 * not `In Person`. Do the word-splitting/casing here in JS instead of
 * reaching for the CSS-only shortcut again.
 */
export function formatLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Normalizes a raw phone number string into a single `(555) 123-4567` shape
 * (with an optional `ext. N` suffix).
 *
 * The seed data contains phone numbers in at least four different raw
 * formats: parens `(555) 123-4567`, dots `555.123.4567`, dashes
 * `555-123-4567`, and numbers with a country-code prefix (`+1...` or
 * `001...`) and/or an `x1234`-style extension marker. This function:
 *  1. Splits off any `x`-prefixed extension before touching the digits.
 *  2. Strips every non-digit character from the remaining number.
 *  3. Drops a leading country-code prefix if the digit count implies one
 *     (13 digits starting with `001`, or 11 digits starting with `1`).
 *  4. Re-assembles the remaining 10 digits into `(555) 123-4567` and appends
 *     `ext. N` if an extension was present.
 *
 * If, after all that, the digit count still isn't exactly 10, the function
 * falls back to returning the original raw string unchanged. That fallback
 * is a safety net for malformed input — it isn't exercised by the current
 * seed data, but it's here so an unexpected format degrades gracefully
 * instead of rendering garbage.
 */
export function formatPhone(value: string): string {
  const [main, extension] = value.split(/x/i);
  let digits = main.replace(/\D/g, "");

  if (digits.length === 13 && digits.startsWith("001")) {
    digits = digits.slice(3);
  } else if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) return value;

  const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return extension ? `${formatted} ext. ${extension}` : formatted;
}

/**
 * Formats a start/end ISO datetime pair as a single time range on one line
 * (e.g. `"9:00 AM – 9:30 AM"`) for an appointment service's time slot. Only
 * the time is shown, not the date — the enclosing appointment card already
 * shows the date once for all of its services.
 */
export function formatTimeRange(start: string, end: string): string {
  const timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const startLabel = new Date(start).toLocaleTimeString("en-US", timeOptions);
  const endLabel = new Date(end).toLocaleTimeString("en-US", timeOptions);
  return `${startLabel} – ${endLabel}`;
}

/**
 * Parses a "YYYY-MM-DD" date-only string into a `Date` at LOCAL midnight.
 *
 * `new Date("2026-01-15")` parses a date-only ISO string as UTC midnight,
 * which `.getDay()`/`.getDate()` etc. then read back in the *local*
 * timezone — in any timezone behind UTC, that silently renders as the
 * previous day. The Calendar view relies on `.getDay()` to line up each
 * day under the right weekday column, so that off-by-one would visibly
 * misalign the grid. Constructing the `Date` from its parts directly
 * (`new Date(year, month, day)`) always means local midnight, sidestepping
 * the UTC round-trip entirely.
 */
export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Formats a "YYYY-MM" month string as e.g. "December 2025". */
export function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum - 1, 1).toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

/**
 * Computes a whole-number age in years from an ISO date-of-birth string,
 * accounting for whether this year's birthday has happened yet (not just
 * a naive year subtraction).
 */
export function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;

  return age;
}
