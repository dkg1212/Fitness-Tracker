"""
History & consistency router.

Performance notes
─────────────────
• /history/stats:  Fetches only the `date` field from workouts (tiny payload).
  Three DB calls run in parallel via asyncio.gather.
  The day-loop uses a pre-built weekday lookup dict so _split_for_date is O(1).

• /history/calendar: Fetches only the requested month's workout documents
  (date-range filter) plus slim fields needed for CalendarWorkoutSummary.
  Split history and current split are fetched in parallel.

• /history/splits:  Thin metadata only; no exercise data loaded.

RISK-06 fix
───────────
The original _split_for_date cache compared a list object to a string with
`if split_days is not _cached_split_iso`, which always evaluates True (a list
is never `is` a str), so the lookup dict was rebuilt on every loop iteration.
Fixed: the cache key is now `id(split_days)` — the CPython object identity of
the list returned by _split_for_date.  Consecutive calendar days that resolve
to the same split config object get a single lookup dict build.
"""
from __future__ import annotations

import asyncio
import calendar as _cal
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query

from lib.auth import current_user
from lib.dates import get_app_tz, today_iso
from lib.db import db
from lib.training import completed_set_count, duration_min, workout_volume
from models.history import (
    CalendarDay,
    CalendarResponse,
    CalendarWorkoutSummary,
    ConsistencyStats,
    SplitHistoryDay,
    SplitHistoryRecord,
)
from models.workout import Workout

router = APIRouter(prefix="/history", tags=["history"])

# ─── Minimal projections ──────────────────────────────────────────────────────

# For consistency stats we only need the date string — nothing else.
_DATE_PROJ = {"_id": 0, "date": 1}

# For the calendar detail we need enough to compute volume/sets/duration.
# Must include all required Workout + WorkoutExercise fields (those without defaults).
_CAL_PROJ = {
    "_id": 0,
    "id": 1,
    "name": 1,
    "date": 1,
    "status": 1,
    "started_at": 1,
    "finished_at": 1,
    "exercises.exercise_id": 1,
    "exercises.exercise_name": 1,
    "exercises.muscle_group": 1,
    "exercises.sets.completed": 1,
    "exercises.sets.set_type": 1,
    "exercises.sets.weight": 1,
    "exercises.sets.reps": 1,
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _month_start(d: date) -> date:
    return d.replace(day=1)


async def _get_workout_dates(user_id: str) -> list[str]:
    """Return just the date strings of all completed workouts, sorted ascending."""
    docs = (
        await db.workouts.find({"user_id": user_id, "status": "completed"}, _DATE_PROJ)
        .sort("date", 1)
        .to_list(20_000)
    )
    return [d["date"] for d in docs]


async def _get_month_workouts(user_id: str, year: int, month: int) -> list[Workout]:
    """Fetch only workouts that fall within the requested month."""
    _, days_in_month = _cal.monthrange(year, month)
    month_start = f"{year:04d}-{month:02d}-01"
    month_end = f"{year:04d}-{month:02d}-{days_in_month:02d}"
    docs = (
        await db.workouts.find(
            {
                "user_id": user_id,
                "status": "completed",
                "date": {"$gte": month_start, "$lte": month_end},
            },
            _CAL_PROJ,
        )
        .sort("date", 1)
        .to_list(200)   # max ~6 workouts/day × 31 days; generous upper bound
    )
    return [Workout(**d) for d in docs]


async def _get_split_history(user_id: str) -> list[SplitHistoryRecord]:
    docs = (
        await db.split_history.find({"user_id": user_id}, {"_id": 0})
        .sort("effective_from", 1)
        .to_list(500)
    )
    return [SplitHistoryRecord(**d) for d in docs]


async def _load_current_split_days(user_id: str) -> list[SplitHistoryDay]:
    doc = await db.splits.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return []
    return [SplitHistoryDay(**d) for d in doc.get("days", [])]


def _split_for_date(
    history: list[SplitHistoryRecord],
    d_iso: str,
    current_split_days: list[SplitHistoryDay],
) -> list[SplitHistoryDay]:
    """Return the split days active on d_iso. Walk newest-first for O(history_len) overall."""
    for rec in reversed(history):
        if rec.effective_from <= d_iso:
            if rec.effective_to is None or d_iso < rec.effective_to:
                return rec.days
    return current_split_days


def _compute_streaks(sorted_dates: list[str], today: date) -> tuple[int, int]:
    """
    sorted_dates: unique workout date strings sorted ascending.
    Returns (current_streak, longest_streak).
    """
    if not sorted_dates:
        return 0, 0

    dates_set = set(sorted_dates)

    # Longest
    longest = 1
    run = 1
    prev = date.fromisoformat(sorted_dates[0])
    for iso in sorted_dates[1:]:
        cur = date.fromisoformat(iso)
        if (cur - prev).days == 1:
            run += 1
            if run > longest:
                longest = run
        else:
            run = 1
        prev = cur

    # Current — walk back from today
    current = 0
    cursor = today
    while cursor.isoformat() in dates_set:
        current += 1
        cursor -= timedelta(days=1)
    if current == 0:
        # Today hasn't been worked out yet — try from yesterday
        cursor = today - timedelta(days=1)
        while cursor.isoformat() in dates_set:
            current += 1
            cursor -= timedelta(days=1)

    return current, max(longest, current)


def _build_weekday_lookup(
    split_days: list[SplitHistoryDay],
) -> dict[int, SplitHistoryDay | None]:
    """Map weekday (0=Mon…6=Sun) → SplitHistoryDay or None for quick O(1) access."""
    lookup: dict[int, SplitHistoryDay | None] = {i: None for i in range(7)}
    for sd in split_days:
        lookup[sd.weekday] = sd
    return lookup


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=ConsistencyStats)
async def consistency_stats(user: dict = Depends(current_user)):
    today = date.fromisoformat(today_iso())

    # Parallel DB fetch — only dates needed for stats
    workout_dates, split_history, current_split_days = await asyncio.gather(
        _get_workout_dates(user["id"]),
        _get_split_history(user["id"]),
        _load_current_split_days(user["id"]),
    )

    _empty = ConsistencyStats(
        total_sessions=0, total_workout_days=0,
        this_week_sessions=0, this_month_sessions=0, this_year_sessions=0,
        current_streak=0, longest_streak=0,
        weekly_consistency_pct=0.0, monthly_consistency_pct=0.0,
        all_time_consistency_pct=0.0,
        scheduled_days_total=0, completed_scheduled_days=0, missed_scheduled_days=0,
    )
    if not workout_dates:
        return _empty

    unique_days = sorted(set(workout_dates))
    total_sessions = len(workout_dates)
    total_workout_days = len(unique_days)

    this_week_start = _week_start(today)
    this_month_start = _month_start(today)
    this_year_start = date(today.year, 1, 1)
    wk_iso = this_week_start.isoformat()
    mo_iso = this_month_start.isoformat()
    yr_iso = this_year_start.isoformat()

    this_week_sessions = sum(1 for d in workout_dates if d >= wk_iso)
    this_month_sessions = sum(1 for d in workout_dates if d >= mo_iso)
    this_year_sessions = sum(1 for d in workout_dates if d >= yr_iso)

    current_streak, longest_streak = _compute_streaks(unique_days, today)

    # Walk every calendar day from the first workout up to (but not including)
    # today, checking whether a workout was scheduled and completed.
    workout_days_set = set(unique_days)
    first_date = date.fromisoformat(unique_days[0])

    all_scheduled: list[str] = []
    week_scheduled: list[str] = []
    month_scheduled: list[str] = []

    # RISK-06 fix: cache the lookup dict keyed by the CPython object identity
    # of the split_days list returned by _split_for_date.  On consecutive days
    # within the same split period, _split_for_date returns the SAME list
    # object, so id() is stable and we avoid rebuilding the dict every day.
    _cached_split_id: int | None = None
    _cached_lookup: dict[int, SplitHistoryDay | None] = {}

    cursor = first_date
    while cursor < today:
        c_iso = cursor.isoformat()
        split_days = _split_for_date(split_history, c_iso, current_split_days)

        # Rebuild lookup only when the split config object identity changes.
        split_id = id(split_days)
        if split_id != _cached_split_id:
            _cached_lookup = _build_weekday_lookup(split_days)
            _cached_split_id = split_id

        entry = _cached_lookup.get(cursor.weekday())
        if entry and entry.template_id:
            all_scheduled.append(c_iso)
            if c_iso >= wk_iso:
                week_scheduled.append(c_iso)
            if c_iso >= mo_iso:
                month_scheduled.append(c_iso)
        cursor += timedelta(days=1)

    def _pct(lst: list[str]) -> float:
        if not lst:
            return 0.0
        done = sum(1 for d in lst if d in workout_days_set)
        return round(done / len(lst) * 100, 1)

    def _counts(lst: list[str]) -> tuple[int, int]:
        done = sum(1 for d in lst if d in workout_days_set)
        return done, len(lst) - done

    comp_all, missed_all = _counts(all_scheduled)

    return ConsistencyStats(
        total_sessions=total_sessions,
        total_workout_days=total_workout_days,
        this_week_sessions=this_week_sessions,
        this_month_sessions=this_month_sessions,
        this_year_sessions=this_year_sessions,
        current_streak=current_streak,
        longest_streak=longest_streak,
        weekly_consistency_pct=_pct(week_scheduled),
        monthly_consistency_pct=_pct(month_scheduled),
        all_time_consistency_pct=_pct(all_scheduled),
        scheduled_days_total=len(all_scheduled),
        completed_scheduled_days=comp_all,
        missed_scheduled_days=missed_all,
    )


@router.get("/calendar", response_model=CalendarResponse)
async def calendar_view(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    user: dict = Depends(current_user),
):
    today = date.fromisoformat(today_iso())

    # Parallel: only fetch workouts for the requested month
    month_workouts, split_history, current_split_days = await asyncio.gather(
        _get_month_workouts(user["id"], year, month),
        _get_split_history(user["id"]),
        _load_current_split_days(user["id"]),
    )

    by_date: dict[str, list[Workout]] = defaultdict(list)
    for w in month_workouts:
        by_date[w.date].append(w)

    _, days_in_month = _cal.monthrange(year, month)
    result: list[CalendarDay] = []

    for day_num in range(1, days_in_month + 1):
        d = date(year, month, day_num)
        d_iso = d.isoformat()
        split_days = _split_for_date(split_history, d_iso, current_split_days)

        is_scheduled = False
        is_rest = True
        scheduled_template_name: str | None = None

        lookup = _build_weekday_lookup(split_days)
        entry = lookup.get(d.weekday())
        if entry:
            is_scheduled = entry.template_id is not None
            is_rest = not is_scheduled
            scheduled_template_name = entry.template_name if is_scheduled else None

        day_workouts = by_date.get(d_iso, [])
        workout_summaries = [
            CalendarWorkoutSummary(
                id=w.id,
                name=w.name,
                volume=round(workout_volume(w), 1),
                completed_sets=completed_set_count(w),
                duration_min=duration_min(w),
            )
            for w in day_workouts
        ]

        if d > today:
            status = "future" if is_scheduled else "rest"
        elif d == today:
            status = "today"
        elif day_workouts:
            status = "done"
        elif is_scheduled:
            status = "missed"
        else:
            status = "rest"

        result.append(CalendarDay(
            date=d_iso,
            status=status,
            is_scheduled=is_scheduled,
            is_rest=is_rest,
            scheduled_template_name=scheduled_template_name,
            workouts=workout_summaries,
        ))

    return CalendarResponse(year=year, month=month, days=result)


@router.get("/splits", response_model=list[SplitHistoryRecord])
async def get_split_history(user: dict = Depends(current_user)):
    return await _get_split_history(user["id"])
