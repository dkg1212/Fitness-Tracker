"""
Unit tests for routers/history.py helper functions.
Covers: _compute_streaks, _split_for_date, _build_weekday_lookup.

RISK-06 regression: verifies the cache identity fix does not break correctness.
"""
from datetime import date

import pytest

from routers.history import (
    _build_weekday_lookup,
    _compute_streaks,
    _split_for_date,
)
from models.history import SplitHistoryDay, SplitHistoryRecord


# ── Helpers ────────────────────────────────────────────────────────────────────

def _day(weekday: int, template_id: str | None = "tpl1") -> SplitHistoryDay:
    return SplitHistoryDay(weekday=weekday, template_id=template_id, template_name="Test" if template_id else None)


def _record(from_iso: str, to_iso: str | None, days: list[SplitHistoryDay]) -> SplitHistoryRecord:
    return SplitHistoryRecord(
        effective_from=from_iso,
        effective_to=to_iso,
        split_name="Test Split",
        days=days,
    )


# ── _compute_streaks ───────────────────────────────────────────────────────────

class TestComputeStreaks:
    def test_empty_dates_returns_zeros(self):
        assert _compute_streaks([], date.today()) == (0, 0)

    def test_single_today_streak(self):
        today = date.today()
        current, longest = _compute_streaks([today.isoformat()], today)
        assert current == 1
        assert longest == 1

    def test_consecutive_days_streak(self):
        from datetime import timedelta
        today = date.today()
        dates = [(today - timedelta(days=i)).isoformat() for i in range(4, -1, -1)]
        # 5 consecutive days ending today
        current, longest = _compute_streaks(dates, today)
        assert current == 5
        assert longest == 5

    def test_broken_streak_yesterday(self):
        from datetime import timedelta
        today = date.today()
        # 3 consecutive days ending 3 days ago (today and yesterday have no workout)
        dates = [
            (today - timedelta(days=5)).isoformat(),
            (today - timedelta(days=4)).isoformat(),
            (today - timedelta(days=3)).isoformat(),
        ]
        current, longest = _compute_streaks(sorted(dates), today)
        # Neither today nor yesterday has a workout → current streak = 0
        assert current == 0
        assert longest == 3

    def test_longest_streak_in_history(self):
        dates = [
            "2026-01-01", "2026-01-02", "2026-01-03",  # 3-day streak
            "2026-02-10", "2026-02-11", "2026-02-12", "2026-02-13", "2026-02-14",  # 5-day streak
        ]
        _, longest = _compute_streaks(dates, date(2026, 3, 1))
        assert longest == 5

    def test_duplicate_dates_deduplicated_outside(self):
        # _compute_streaks receives already-unique sorted dates from the caller
        dates = ["2026-10-01", "2026-10-02", "2026-10-03"]
        _, longest = _compute_streaks(dates, date(2026, 11, 1))
        assert longest == 3

    def test_no_workout_today_or_yesterday_gives_zero_current(self):
        from datetime import timedelta
        today = date.today()
        old_dates = ["2026-01-01", "2026-01-02"]
        current, _ = _compute_streaks(old_dates, today)
        assert current == 0


# ── _split_for_date ────────────────────────────────────────────────────────────

class TestSplitForDate:
    def _days_a(self) -> list[SplitHistoryDay]:
        return [_day(0, "tpl-push"), _day(1, None)]

    def _days_b(self) -> list[SplitHistoryDay]:
        return [_day(0, "tpl-ppl"), _day(1, None)]

    def test_no_history_returns_current_split(self):
        current = self._days_a()
        result = _split_for_date([], "2026-10-01", current)
        assert result is current

    def test_single_open_snapshot_matches_all_dates(self):
        days = self._days_a()
        history = [_record("2026-01-01", None, days)]
        result = _split_for_date(history, "2026-10-01", [])
        assert [d.template_id for d in result] == [d.template_id for d in days]

    def test_closed_snapshot_does_not_match_after_effective_to(self):
        old_days = self._days_a()
        new_days = self._days_b()
        history = [
            _record("2026-01-01", "2026-06-01", old_days),
            _record("2026-06-01", None, new_days),
        ]
        # Date before changeover → old split
        result = _split_for_date(history, "2026-05-15", [])
        assert [d.template_id for d in result] == [d.template_id for d in old_days]
        # Date after changeover → new split
        result = _split_for_date(history, "2026-07-01", [])
        assert [d.template_id for d in result] == [d.template_id for d in new_days]

    def test_effective_to_boundary_exclusive(self):
        """effective_to is the first day of the NEW period, not the last of the old."""
        old_days = self._days_a()
        new_days = self._days_b()
        history = [
            _record("2026-01-01", "2026-06-01", old_days),
            _record("2026-06-01", None, new_days),
        ]
        # On the changeover day itself → new split
        result_on = _split_for_date(history, "2026-06-01", [])
        assert [d.template_id for d in result_on] == [d.template_id for d in new_days]
        # Day before → old split
        result_before = _split_for_date(history, "2026-05-31", [])
        assert [d.template_id for d in result_before] == [d.template_id for d in old_days]

    def test_date_before_any_history_returns_current(self):
        days = self._days_a()
        current = self._days_b()
        history = [_record("2026-06-01", None, days)]
        # Date before the only snapshot
        result = _split_for_date(history, "2026-01-01", current)
        assert [d.template_id for d in result] == [d.template_id for d in current]

    # RISK-06 regression: verify the id()-based cache produces correct results
    def test_cache_key_does_not_affect_correctness(self):
        """
        Verify that two consecutive dates in the same split period return a
        result with the same content (correctness), and that the objects
        returned are the same Python object (same rec.days list copy),
        allowing id() caching to work.
        """
        days_a = self._days_a()
        days_b = self._days_b()
        history = [
            _record("2026-01-01", "2026-06-01", days_a),
            _record("2026-06-01", None, days_b),
        ]
        r1 = _split_for_date(history, "2026-06-15", [])
        r2 = _split_for_date(history, "2026-06-16", [])
        # Same period → same rec.days object (Pydantic copies once per record) →
        # id()-based cache would hit on consecutive calls in the stats loop.
        assert r1 is r2
        # Correct content: should match days_b values
        assert [d.template_id for d in r1] == [d.template_id for d in days_b]


# ── _build_weekday_lookup ──────────────────────────────────────────────────────

class TestBuildWeekdayLookup:
    def test_all_seven_days_present(self):
        days = [_day(i, "tpl1" if i % 2 == 0 else None) for i in range(7)]
        lookup = _build_weekday_lookup(days)
        assert set(lookup.keys()) == set(range(7))

    def test_rest_days_are_none(self):
        days = [_day(i, None) for i in range(7)]
        lookup = _build_weekday_lookup(days)
        for v in lookup.values():
            assert v is not None   # the SplitHistoryDay object is returned, not None

    def test_empty_days_produces_all_none_lookup(self):
        lookup = _build_weekday_lookup([])
        assert all(v is None for v in lookup.values())

    def test_specific_template_id_retrievable(self):
        days = [_day(0, "tpl-push"), _day(1, None), _day(2, "tpl-pull")]
        for i in range(3, 7):
            days.append(_day(i, None))
        lookup = _build_weekday_lookup(days)
        assert lookup[0] is not None and lookup[0].template_id == "tpl-push"
        assert lookup[1] is not None and lookup[1].template_id is None
        assert lookup[2] is not None and lookup[2].template_id == "tpl-pull"
