"use client";

/**
 * Filter/search toolbar for the All Patients tab: a plain anchored "Filters" button,
 * rendered by `PatientsPage` in the shared tab row (right-aligned, next to the
 * left-aligned tab selector), that opens a dropdown card. The card is anchored to the
 * button's right edge and expands leftward/downward from that corner (`origin-top-right`),
 * the same way any standard dropdown menu behaves — no scroll-tracking, no
 * shape-morphing, just a clean fade+scale.
 *
 * The card holds an "Add Filter" builder -- one row per active filter condition, each
 * [column] [operator] [value(s)] [remove], rather than a fixed panel with one hardcoded
 * field per named backend param (Age, Source, Gender, ...). That fixed shape couldn't
 * scale to "way more filtration options" (a not-equals on Source, a between on
 * Appointments, ...) without a new hand-built field every time; the builder instead
 * reads its available columns/operators from `lib/patientFilters.ts`'s registry, so a
 * new filterable column is one registry entry, not a new UI field. Sorting used to live
 * here too (a "Sort: X" dropdown) -- removed in favor of column-header click-to-sort
 * (see `PatientTable`), which covers every column this dropdown ever could plus several
 * it couldn't (Age, Gender, Appointments, ...).
 *
 * The toggle button shares `FILTER_PILL_CLASSNAME` with `ScheduleFilters` (Today's
 * Appointments' own filter control) so the two read as one consistent style.
 *
 * Holds its own open/closed UI state and the in-progress filter rows -- the actual
 * `filters` array is owned by `PatientsPage` and passed in via `filters.filters`, with
 * every change reported upward via `onChange`. A row is kept and displayed the moment
 * its column is picked (so partially-built filters don't vanish while being edited),
 * but `PatientTable` only ever sends the COMPLETE subset (see `isCompleteFilterCondition`)
 * to the API -- an in-progress row with no value yet is simply not queried on until it has one.
 */

import { useEffect, useRef, useState } from "react";

import type { PatientQueryParams } from "@/lib/api";
import { FILTER_FIELD_CLASSNAME, FILTER_PILL_CLASSNAME } from "@/lib/pillStyles";
import {
  FILTERABLE_COLUMNS,
  OPERATORS_BY_TYPE,
  columnByKey,
  isCompleteFilterCondition,
  newDraftCondition,
  valueShapeFor,
  type PatientFilterCondition,
} from "@/lib/patientFilters";

interface Props {
  /** Current search/filter state, owned by the parent (`PatientTable`). */
  filters: PatientQueryParams;
  /** Reports a partial update to the parent; parent merges it into `filters`. */
  onChange: (next: Partial<PatientQueryParams>) => void;
}

/** Three-line "sliders" glyph — a plain inline SVG so this doesn't need an icon library dependency. */
function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The value editor for one filter row -- its shape (one field, a range, or a checklist) depends on the column's type and the chosen operator. */
function ValueEditor({ condition, onChange }: { condition: PatientFilterCondition; onChange: (patch: Partial<PatientFilterCondition>) => void }) {
  const column = columnByKey(condition.field);
  if (!column) return null;
  const shape = valueShapeFor(condition.operator);

  if (column.type === "enum" && shape === "multi") {
    const selected = new Set(condition.values ?? []);
    const toggle = (value: string) => {
      const next = new Set(selected);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      onChange({ values: Array.from(next) });
    };
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-brand-dark/10 bg-brand-dark/5 px-3 py-2">
        {column.enumOptions?.map((option) => (
          <label key={option.value} className="flex items-center gap-1.5 text-sm text-brand-dark">
            <input type="checkbox" checked={selected.has(option.value)} onChange={() => toggle(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  if (column.type === "enum") {
    return (
      <select className={`w-full ${FILTER_FIELD_CLASSNAME}`} value={condition.value ?? ""} onChange={(e) => onChange({ value: e.target.value || undefined })}>
        <option value="">Select…</option>
        {column.enumOptions?.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  const inputType = column.type === "number" ? "number" : column.type === "date" ? "date" : "text";

  if (shape === "double") {
    return (
      <div className="flex items-center gap-2">
        <input
          type={inputType}
          placeholder="From"
          aria-label={`${column.label} minimum`}
          className={`w-full min-w-0 ${FILTER_FIELD_CLASSNAME}`}
          value={condition.value ?? ""}
          onChange={(e) => onChange({ value: e.target.value || undefined })}
        />
        <span className="text-brand-dark/40">–</span>
        <input
          type={inputType}
          placeholder="To"
          aria-label={`${column.label} maximum`}
          className={`w-full min-w-0 ${FILTER_FIELD_CLASSNAME}`}
          value={condition.value2 ?? ""}
          onChange={(e) => onChange({ value2: e.target.value || undefined })}
        />
      </div>
    );
  }

  return (
    <input
      type={inputType}
      placeholder={column.type === "text" ? "Value" : undefined}
      aria-label={`${column.label} value`}
      className={`w-full ${FILTER_FIELD_CLASSNAME}`}
      value={condition.value ?? ""}
      onChange={(e) => onChange({ value: e.target.value || undefined })}
    />
  );
}

export function PatientFilters({ filters, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const conditions = filters.filters ?? [];
  const activeCount = (filters.search ? 1 : 0) + conditions.filter(isCompleteFilterCondition).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function updateCondition(index: number, patch: Partial<PatientFilterCondition>) {
    const next = conditions.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onChange({ filters: next });
  }

  function handleFieldChange(index: number, field: string) {
    const column = columnByKey(field);
    if (!column) return;
    // Changing the column resets operator/value(s) -- the old operator/value(s) may not
    // even be valid for the new column's type (e.g. switching from a number column's
    // "between" to an enum column, which has no such operator).
    updateCondition(index, { field, operator: OPERATORS_BY_TYPE[column.type][0].value, value: undefined, value2: undefined, values: undefined });
  }

  function handleOperatorChange(index: number, operator: string) {
    // Changing the operator resets value(s) whenever the value SHAPE changes (single ->
    // range -> multi-select) -- a stale `value2` left over from a "between" would
    // otherwise silently ride along into an operator that ignores it.
    const current = conditions[index];
    const shapeChanged = valueShapeFor(operator) !== valueShapeFor(current.operator);
    updateCondition(index, shapeChanged ? { operator, value: undefined, value2: undefined, values: undefined } : { operator });
  }

  function removeCondition(index: number) {
    onChange({ filters: conditions.filter((_, i) => i !== index) });
  }

  function addCondition() {
    onChange({ filters: [...conditions, newDraftCondition()] });
  }

  return (
    // `ml-auto` keeps this control pinned to the tab row's right edge even when it wraps
    // onto its own line at phone width (the row above uses `flex-wrap`, and when the tab
    // pills alone fill a whole line, this button was the sole item left on the next line
    // -- flexbox places a lone wrapped item at that line's START, not its end, without
    // this). That mattered because the dropdown card below is `absolute right-0`,
    // anchored to THIS element's own right edge -- with the button sitting at the row's
    // left edge instead of its right, the card's fixed 22rem width extended almost
    // entirely off the left side of the viewport (confirmed via a real mobile screenshot:
    // every field showed only its last few characters, the rest clipped off-screen).
    <div ref={containerRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={FILTER_PILL_CLASSNAME}
      >
        <FilterIcon />
        Filters
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/*
        Anchored to the button's right edge; `origin-top-right` makes it visibly unfold
        leftward/downward from that corner. Width is capped at `calc(100vw-1.5rem)` so it
        can never overflow off the left edge of a narrow phone screen the way a fixed
        `26rem` would below ~420px. Wider than the old fixed panel (22rem -> 26rem) --
        each filter row now packs a column select, an operator select, AND a value editor
        onto one line, which needs more room than a single labeled field did.
      */}
      <div
        className={`absolute right-0 top-full z-30 mt-2 max-h-[70vh] w-[26rem] max-w-[calc(100vw-1.5rem)] origin-top-right overflow-y-auto rounded-2xl border border-brand-gold/10 bg-brand-bg p-4 shadow-xl transition-all duration-150 ease-out ${
          isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Search name, email, or phone"
            className={FILTER_FIELD_CLASSNAME}
            defaultValue={filters.search ?? ""}
            onChange={(e) => onChange({ search: e.target.value })}
          />

          {conditions.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-brand-dark/10 pt-3">
              {conditions.map((condition, index) => {
                const column = columnByKey(condition.field);
                if (!column) return null;
                return (
                  <div key={index} className="flex flex-col gap-1.5 rounded-xl border border-brand-dark/10 p-2">
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label="Filter column"
                        className={`min-w-0 flex-1 ${FILTER_FIELD_CLASSNAME}`}
                        value={condition.field}
                        onChange={(e) => handleFieldChange(index, e.target.value)}
                      >
                        {FILTERABLE_COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter operator"
                        className={`min-w-0 flex-1 ${FILTER_FIELD_CLASSNAME}`}
                        value={condition.operator}
                        onChange={(e) => handleOperatorChange(index, e.target.value)}
                      >
                        {OPERATORS_BY_TYPE[column.type].map((op) => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label="Remove filter"
                        onClick={() => removeCondition(index)}
                        className="shrink-0 rounded-full p-1.5 text-brand-dark/40 transition-colors hover:bg-coral/10 hover:text-coral"
                      >
                        ✕
                      </button>
                    </div>
                    <ValueEditor condition={condition} onChange={(patch) => updateCondition(index, patch)} />
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={addCondition}
            className="rounded-lg border border-dashed border-brand-dark/20 px-3 py-2 text-sm font-medium text-brand-dark/60 transition-colors hover:border-brand-gold hover:text-brand-gold-dark"
          >
            + Add Filter
          </button>
        </div>
      </div>
    </div>
  );
}
