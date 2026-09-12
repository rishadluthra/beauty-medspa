"""The generic, per-column-type filter representation for the Patient Table page.

Replaces the earlier All Patients filter shape (a fixed set of named query params --
`source`, `gender`, `age_min`/`age_max`, `created_from`/`created_to`,
`min_total_spent_cents`) with a small, general filter condition that scales to any
column without a new named param per field: `{field, operator, value(s)}`. This is also
squarely in the "AI-ready" spirit the spec calls for (a reusable, composable query shape
a future natural-language-query service could construct directly, rather than a
bespoke per-page parameter list).

`FIELD_TYPES` is the single source of truth for which columns exist and what kind of
data each holds; `OPERATORS_BY_TYPE` is the single source of truth for which operators
are valid for each kind. Both the router (validating a request) and a future
natural-language layer would consult these same two dicts, so "what can I filter by, and
how" never has to be answered twice.

`phone` is deliberately absent from `FIELD_TYPES` -- per direct product decision, phone
numbers aren't a meaningful thing to filter OR sort by (they're an identifier, not a
value with a meaningful order or a small set of comparable states), the same reasoning
that excludes it from column-header sorting everywhere else in this app.
"""

from pydantic import BaseModel, model_validator

# Every filterable All Patients column, and what kind of value it holds. `text`: a
# free-form string (contains/equals-style operators). `number`: a numeric value
# (comparison operators, including "between"). `date`: a calendar date (before/after/
# on, including "between"). `enum`: one of a small fixed set of known values
# (is/is-not/is-any-of/is-none-of).
FIELD_TYPES: dict[str, str] = {
    "name": "text",
    "email": "text",
    "age": "number",
    "gender": "enum",
    "source": "enum",
    "created_date": "date",
    "appointment_count": "number",
    "total_spent_cents": "number",
    "last_appointment_date": "date",
}

OPERATORS_BY_TYPE: dict[str, set[str]] = {
    "text": {"contains", "not_contains", "equals", "not_equals"},
    "number": {"eq", "ne", "gt", "gte", "lt", "lte", "between"},
    "date": {"on", "not_on", "before", "after", "on_or_before", "on_or_after", "between"},
    "enum": {"is", "is_not", "is_any_of", "is_none_of"},
}

# The known values for each enum field -- used only to give a clean 400 (rather than a
# query that silently matches nothing) if a caller sends a value outside this set.
ENUM_VALUES: dict[str, set[str]] = {
    "gender": {"male", "female", "other"},
    "source": {"in_person", "phone", "instagram", "tiktok", "google", "website"},
}

_MULTI_VALUE_OPERATORS = {"is_any_of", "is_none_of"}
_TWO_VALUE_OPERATORS = {"between"}


class PatientFilterCondition(BaseModel):
    """One `{field, operator, value}` filter condition. `value`/`value2` are single
    values (as strings -- callers send numbers/dates as their string representation;
    `app.repositories.patients` parses them back per the field's actual type); `value2`
    is the second bound for `operator="between"`. `values` is used instead of `value`
    for `is_any_of`/`is_none_of`, which compare against a set rather than one value.

    Validated structurally here (right shape of value(s) for the given operator);
    `app.repositories.patients._validate_filter_condition` does the second pass that
    needs the field registry (unknown field, operator not valid for that field's type),
    since that's shared with the actual query-building code and shouldn't be answered
    two different ways in two different places.
    """

    field: str
    operator: str
    value: str | None = None
    value2: str | None = None
    values: list[str] | None = None

    @model_validator(mode="after")
    def _check_value_shape(self) -> "PatientFilterCondition":
        if self.operator in _MULTI_VALUE_OPERATORS:
            if not self.values:
                raise ValueError(f"operator {self.operator!r} requires a non-empty 'values' list")
        elif self.operator in _TWO_VALUE_OPERATORS:
            if self.value is None or self.value2 is None:
                raise ValueError(f"operator {self.operator!r} requires both 'value' and 'value2'")
        elif self.value is None:
            raise ValueError(f"operator {self.operator!r} requires 'value'")
        return self
