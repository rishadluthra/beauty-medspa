/**
 * The generic, per-column-type filter system for the All Patients table -- the
 * frontend's mirror of the backend's `app.schemas.patient_filters` registry (same field
 * keys, same operator sets per type), so "what can I filter by, and how" is answered
 * identically on both sides rather than risking the two silently drifting apart.
 *
 * Replaces the earlier fixed filter panel (one hardcoded UI field per named backend
 * param -- `source`, `age_min`/`age_max`, etc.) with a small column registry that both
 * the "Add Filter" builder (`PatientFilters`) and column-header click-to-sort
 * (`PatientTable`) read from, so adding a new filterable/sortable column in the future
 * means adding one entry here, not touching UI code in two different places.
 */

export type ColumnType = "text" | "number" | "date" | "enum";

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  /** Whether this column supports both header-click sorting and (for non-phone columns) filtering. */
  sortable: boolean;
  /** `enum` columns only: the raw backend value + its display label, for the value picker. */
  enumOptions?: { value: string; label: string }[];
}

/**
 * Every All Patients column, in table-display order. `phone` is deliberately marked
 * `sortable: false` and is never filterable at all (see `FILTERABLE_COLUMNS` below) --
 * per direct product decision, a phone number is an identifier, not a value with a
 * meaningful order or a small set of comparable states, the same reasoning the backend's
 * `FIELD_TYPES` registry excludes it for.
 */
export const PATIENT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", type: "text", sortable: true },
  { key: "phone", label: "Phone", type: "text", sortable: false },
  { key: "email", label: "Email", type: "text", sortable: true },
  { key: "age", label: "Age", type: "number", sortable: true },
  { key: "gender", label: "Gender", type: "enum", sortable: true, enumOptions: [
    { value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" },
  ] },
  { key: "source", label: "Source", type: "enum", sortable: true, enumOptions: [
    { value: "in_person", label: "In Person" }, { value: "phone", label: "Phone" }, { value: "instagram", label: "Instagram" },
    { value: "tiktok", label: "TikTok" }, { value: "google", label: "Google" }, { value: "website", label: "Website" },
  ] },
  { key: "created_date", label: "Joined", type: "date", sortable: true },
  { key: "appointment_count", label: "Appointments", type: "number", sortable: true },
  { key: "total_spent_cents", label: "Spent", type: "number", sortable: true },
  { key: "last_appointment_date", label: "Last Appointment", type: "date", sortable: true },
];

/** Columns the "Add Filter" builder can offer -- every column except Phone. */
export const FILTERABLE_COLUMNS = PATIENT_COLUMNS.filter((c) => c.key !== "phone");

export function columnByKey(key: string): ColumnDef | undefined {
  return PATIENT_COLUMNS.find((c) => c.key === key);
}

/** One `{field, operator, value(s)}` filter condition -- mirrors the backend's `PatientFilterCondition`. */
export interface PatientFilterCondition {
  field: string;
  operator: string;
  value?: string;
  value2?: string;
  values?: string[];
}

export const OPERATORS_BY_TYPE: Record<ColumnType, { value: string; label: string }[]> = {
  text: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
    { value: "equals", label: "is" },
    { value: "not_equals", label: "is not" },
  ],
  number: [
    { value: "eq", label: "=" },
    { value: "ne", label: "≠" },
    { value: "gt", label: ">" },
    { value: "gte", label: "≥" },
    { value: "lt", label: "<" },
    { value: "lte", label: "≤" },
    { value: "between", label: "between" },
  ],
  date: [
    { value: "on", label: "on" },
    { value: "not_on", label: "not on" },
    { value: "before", label: "before" },
    { value: "after", label: "after" },
    { value: "on_or_before", label: "on or before" },
    { value: "on_or_after", label: "on or after" },
    { value: "between", label: "between" },
  ],
  enum: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
    { value: "is_any_of", label: "is any of" },
    { value: "is_none_of", label: "is none of" },
  ],
};

const MULTI_VALUE_OPERATORS = new Set(["is_any_of", "is_none_of"]);
const TWO_VALUE_OPERATORS = new Set(["between"]);

/** How a value editor should render for a given operator: one field, two (a range), or a multi-select. */
export function valueShapeFor(operator: string): "single" | "double" | "multi" {
  if (MULTI_VALUE_OPERATORS.has(operator)) return "multi";
  if (TWO_VALUE_OPERATORS.has(operator)) return "double";
  return "single";
}

/**
 * Whether a filter condition has everything its operator needs to be sent to the API --
 * a condition is kept in local UI state the moment a column is picked (so its row
 * renders), but must not be sent to the backend (and would 400 if it were) until its
 * value(s) are actually filled in. `PatientTable` filters the array down to only
 * complete conditions right before calling `api.getPatients`.
 */
export function isCompleteFilterCondition(condition: PatientFilterCondition): boolean {
  if (valueShapeFor(condition.operator) === "multi") return !!condition.values && condition.values.length > 0;
  if (valueShapeFor(condition.operator) === "double") return !!condition.value && !!condition.value2;
  return !!condition.value;
}

/** A fresh, incomplete draft condition for a newly added filter row, defaulting to the first non-phone column. */
export function newDraftCondition(): PatientFilterCondition {
  const column = FILTERABLE_COLUMNS[0];
  return { field: column.key, operator: OPERATORS_BY_TYPE[column.type][0].value };
}
