import re

from pymongo import ASCENDING, DESCENDING


def text_search_clauses(term, text_fields, numeric_field=None):
    if not term or not term.strip():
        return []

    value = term.strip()
    pattern = re.compile(re.escape(value), re.IGNORECASE)
    clauses = [{field: pattern} for field in text_fields]

    if numeric_field and value.isdigit():
        clauses.append({numeric_field: int(value)})

    return clauses


def sort_spec(sort_by, sort_dir, allowed, default_dir="asc"):
    if not sort_by:
        return None

    fields = allowed[sort_by]
    if isinstance(fields, str):
        fields = [fields]

    direction = DESCENDING if (sort_dir or default_dir) == "desc" else ASCENDING
    return [(field, direction) for field in fields]


def combine_filters(*filters):
    active = [item for item in filters if item]
    if not active:
        return {}
    if len(active) == 1:
        return active[0]
    return {"$and": active}
