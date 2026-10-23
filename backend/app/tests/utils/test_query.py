import re

from app.utils.query import combine_filters, sort_spec, text_search_clauses


class TestTextSearchClauses:
    def test_empty_search_returns_no_clauses(self):
        assert text_search_clauses("", ["villa"]) == []
        assert text_search_clauses("   ", ["villa"]) == []

    def test_builds_case_insensitive_clauses_for_each_field(self):
        clauses = text_search_clauses("Villa A", ["villa", "owner_name"])

        assert len(clauses) == 2
        assert [next(iter(clause)) for clause in clauses] == ["villa", "owner_name"]
        for clause in clauses:
            pattern = next(iter(clause.values()))
            assert isinstance(pattern, re.Pattern)
            assert pattern.flags & re.IGNORECASE
            assert pattern.pattern == "Villa\\ A"

    def test_escapes_regex_characters(self):
        clauses = text_search_clauses("A.*[1]", ["villa"])
        assert clauses[0]["villa"].pattern == "A\\.\\*\\[1\\]"

    def test_adds_numeric_clause_for_digits(self):
        clauses = text_search_clauses("12", ["villa"], numeric_field="number")
        assert {"number": 12} in clauses

    def test_does_not_add_numeric_clause_for_mixed_text(self):
        clauses = text_search_clauses("A12", ["villa"], numeric_field="number")
        assert {"number": 12} not in clauses


class TestSortSpec:
    def test_returns_none_without_sort_field(self):
        assert sort_spec(None, "desc", {"date": "issue_date"}) is None

    def test_maps_single_field_with_direction(self):
        assert sort_spec("date", "desc", {"date": "issue_date"}) == [("issue_date", -1)]
        assert sort_spec("date", "asc", {"date": "issue_date"}) == [("issue_date", 1)]

    def test_uses_default_direction(self):
        assert sort_spec("amount", None, {"amount": "amount"}, default_dir="desc") == [
            ("amount", -1)
        ]

    def test_maps_multiple_fields(self):
        assert sort_spec("period", "asc", {"period": ["year", "month"]}) == [
            ("year", 1),
            ("month", 1),
        ]


class TestCombineFilters:
    def test_returns_empty_dict_without_filters(self):
        assert combine_filters(None, {}) == {}

    def test_returns_single_filter(self):
        assert combine_filters({"a": 1}) == {"a": 1}

    def test_combines_multiple_filters(self):
        assert combine_filters({"a": 1}, {"b": 2}) == {"$and": [{"a": 1}, {"b": 2}]}
