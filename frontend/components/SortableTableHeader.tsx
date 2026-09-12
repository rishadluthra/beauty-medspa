"use client";

/**
 * One `<th>` for a click-to-sort table column, shared by every sortable table in this
 * app (`PatientTable`, `ScheduleTable`, `RebookingOpportunitiesTable`) so they can't
 * drift apart on how a sortable header looks/behaves. A column with no `sortKey` (e.g.
 * Phone, everywhere in this app -- see each table's own docs for why) renders as plain
 * text instead of a button.
 *
 * Clicking a header sorts by it ascending; clicking the already-active header flips to
 * descending -- the same two-state cycle every sortable column in this app uses, driven
 * by whichever page/table owns the actual `sort`/`sortDir` state and reacts to `onSort`.
 */

function SortArrow({ direction }: { direction: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={`h-3 w-3 transition-transform ${direction === "desc" ? "rotate-180" : ""}`}>
      <path d="M3 7.5 6 4.5 9 7.5" />
    </svg>
  );
}

interface Props {
  label: string;
  /** Omit (or leave undefined) for a non-sortable column -- renders as plain text, no button. */
  sortKey?: string;
  activeSort: string;
  activeDir: string;
  onSort: (key: string) => void;
}

export function SortableTableHeader({ label, sortKey, activeSort, activeDir, onSort }: Props) {
  const baseClassName = "whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-brand-dark/50";
  if (!sortKey) {
    return <th className={baseClassName}>{label}</th>;
  }
  const isActive = activeSort === sortKey;
  return (
    <th className={baseClassName}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 transition-colors hover:text-brand-dark ${isActive ? "text-brand-dark" : ""}`}
      >
        {label}
        {isActive && <SortArrow direction={activeDir} />}
      </button>
    </th>
  );
}
