"""
History & consistency router.

Endpoints
─────────
GET  /history/stats              All-time stats + streaks + consistency %
GET  /history/calendar           Month calendar with per-day status
POST /history/split-snapshot     (internal) save a split snapshot
GET  /history/splits             All historical split snapshots for the user

Design notes
────────────
• Streaks count consecutive calendar days with ≥1 completed workout.
  Rest days do NOT break a streak (streaks are workout-day based, not schedule-based).
• Consistency uses the user's split history to determine what was scheduled on
  each past day.  If no split history exists yet (feature is new for existing
  users) the CURRENT split is assumed to have been in effect since the user's
  first workout — this is a sensible bootstrap and is clearly called out.
• All date arithmetic uses the APP_TZ timezone (defaults to UTC) so results
  agree with the workout.date field, which is also set via today_iso().
"""
from __future__ import annotations

import os
from collections import defaultdict
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query

from lib.auth import current_user
from lib.dates import today_iso
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

TZ = ZoneInfo(os.getenv("APP_TZ", "UTC"))


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _week_start(d: date) -> date:
    """Monday of the week containing d."""
    return d - timedelta(days=d.weekday())


def _month_start(d: date) -> date:
    return d.replace(day=1)


async def _get_completed(user_id: str) -> list[Workout]:
    docs = (
        await db.workouts.find({"user_id": user_id, "status": "completed"}, {"_id": 0})
        .sort("date", 1)
        .to_list(10000)
    )
    return [Workout(**d) for d in docs]


async def _get_split_history(user_id: str) -> list[SplitHistoryRecord]:
    """Return all split snapshots for the user, sorted oldest-first."""
    docs = (
        await db.split_history.find({"user_id": user_id}, {"_id": 0})
        .sort("effective_from", 1)
        .to_list(500)
    )
    return [SplitHistoryRecord(**d) for d in docs]


def _split_for_date(
    history: list[SplitHistoryRecord],
    d: date,
    current_split_days: list[SplitHistoryDay],
) -> list[SplitHistoryDay] | None:
    """
    Return the split days that were active on a given date.
    Falls back to current_split_days if no history covers that date.
    """
    d_iso = d.isoformat()
    # Walk history newest-first to find the record active on date d
    for rec in reversed(history):
        if rec.effective_from <= d_iso:
            if rec.effective_to is None or d_iso < rec.effective_to:
                return rec.days
    # No matching snapshot — fall back to current split (bootstrap for existing users)
    return current_split_days


def _workout_days_set(workouts: list[Workout]) -> set[str]:
    """Set of unique ISO dates that have at least one completed workout."""
    return {w.date for w in workouts}


def _compute_streaks(workout_dates: set[str], today: date) -> tuple[int, int]:
    """
    Returns (current_streak, longest_streak).
    Streak = consecutive calendar days with ≥1 workout, working backwards from today.
    Rest days do NOT count as training days (they simply don't appear in workout_dates).
    """
    if not workout_dates:
        return 0, 0

    # Longest streak — scan all dates
    sorted_days = sorted(date.fromisoformat(d) for d in workout_dates)
    longest = 1
    run = 1
    for i in range(1, len(sorted_days)):
        if sorted_days[i] - sorted_days[i - 1] == timedelta(days=1):
            run += 1
            longest = max(longest, run)
        else:
            run = 1

    # Current streak — walk backwards from today (or yesterday if today has no workout)
    current = 0
    cursor = today
    while cursor.isoformat() in workout_dates:
        current += 1
        cursor -= timedelta(days=1)
    # Also try starting from yesterday (today may still be upcoming)
    if current == 0:
        cursor = today - timedelta(days=1)
        while cursor.isoformat() in workout_dates:
            current += 1
            cursor -= timedelta(days=1)

    return current, max(longest, current)


def _consistency(
    past_scheduled: list[str],   # ISO dates that WERE scheduled (non-rest) and have passed
    workout_days: set[str],
) -> tuple[int, int, float]:
    """Returns (completed, missed, pct)."""
    completed = sum(1 for d in past_scheduled if d in workout_days)
    missed = len(past_scheduled) - completed
    pct = round(completed / len(past_scheduled) * 100, 1) if past_scheduled else 0.0
    return completed, missed, pct


async def _load_current_split_days(user_id: str) -> list[SplitHistoryDay]:
    doc = await db.splits.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return []
    days_raw = doc.get("days", [])
    return [SplitHistoryDay(**d) for d in days_raw]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=ConsistencyStats)
async def consistency_stats(user: dict = Depends(current_user)):
    today = date.fromisoformat(today_iso())
    workouts = await _get_completed(user["id"])
    split_history = await _get_split_history(user["id"])
    current_split_days = await _load_current_split_days(user["id"])

    if not workouts:
        return ConsistencyStats(
            total_sessions=0,
            total_workout_days=0,
            this_week_sessions=0,
            this_month_sessions=0,
            this_year_sessions=0,
            current_streak=0,
            longest_streak=0,
            weekly_consistency_pct=0.0,
            monthly_consistency_pct=0.0,
            all_time_consistency_pct=0.0,
            scheduled_days_total=0,
            completed_scheduled_days=0,
            missed_scheduled_days=0,
        )

    workout_days = _workout_days_set(workouts)
    first_date = date.fromisoformat(min(workout_days))

    # Period boundaries
    this_week_start = _week_start(today)
    this_month_start = _month_start(today)
    this_year_start = date(today.year, 1, 1)

    this_week_sessions = sum(1 for w in workouts if w.date >= this_week_start.isoformat())
    this_month_sessions = sum(1 for w in workouts if w.date >= this_month_start.isoformat())
    this_year_sessions = sum(1 for w in workouts if w.date >= this_year_start.isoformat())

    current_streak, longest_streak = _compute_streaks(workout_days, today)

    # Build list of past scheduled (non-rest) days
    all_past_scheduled: list[str] = []
    week_past_scheduled: list[str] = []
    month_past_scheduled: list[str] = []

    cursor = first_date
    while cursor < today:
        split_days = _split_for_date(split_history, cursor, current_split_days)
        if split_days:
            weekday = cursor.weekday()  # 0=Mon
            day_entry = next((d for d in split_days if d.weekday == weekday), None)
            is_scheduled = day_entry is not None and day_entry.template_id is not None
            if is_scheduled:
                iso = cursor.isoformat()
                all_past_scheduled.append(iso)
                if cursor >= this_week_start:
                    week_past_scheduled.append(iso)
                if cursor >= this_month_start:
                    month_past_scheduled.append(iso)
        cursor += timedelta(days=1)

    comp_all, missed_all, pct_all = _consistency(all_past_scheduled, workout_days)
    _, _, pct_week = _consistency(week_past_scheduled, workout_days)
    _, _, pct_month = _consistency(month_past_scheduled, workout_days)

    return ConsistencyStats(
        total_sessions=len(workouts),
        total_workout_days=len(workout_days),
        this_week_sessions=this_week_sessions,
        this_month_sessions=this_month_sessions,
        this_year_sessions=this_year_sessions,
        current_streak=current_streak,
        longest_streak=longest_streak,
        weekly_consistency_pct=pct_week,
        monthly_consistency_pct=pct_month,
        all_time_consistency_pct=pct_all,
        scheduled_days_total=len(all_past_scheduled),
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
    workouts = await _get_completed(user["id"])
    split_history = await _get_split_history(user["id"])
    current_split_days = await _load_current_split_days(user["id"])

    # Group workouts by date
    by_date: dict[str, list[Workout]] = defaultdict(list)
    for w in workouts:
        by_date[w.date].append(w)

    # Build calendar days for the entire month
    import calendar as _cal
    _, days_in_month = _cal.monthrange(year, month)
    result: list[CalendarDay] = []

    for day_num in range(1, days_in_month + 1):
        d = date(year, month, day_num)
        d_iso = d.isoformat()
        split_days = _split_for_date(split_history, d, current_split_days)

        is_scheduled = False
        is_rest = True
        scheduled_template_name: str | None = None

        if split_days:
            weekday = d.weekday()
            day_entry = next((sd for sd in split_days if sd.weekday == weekday), None)
            if day_entry:
                is_scheduled = day_entry.template_id is not None
                is_rest = not is_scheduled
                scheduled_template_name = day_entry.template_name if is_scheduled else None

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

        # Determine status
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

        result.append(
            CalendarDay(
                date=d_iso,
                status=status,
                is_scheduled=is_scheduled,
                is_rest=is_rest,
                scheduled_template_name=scheduled_template_name,
                workouts=workout_summaries,
            )
        )

    return CalendarResponse(year=year, month=month, days=result)


@router.get("/splits", response_model=list[SplitHistoryRecord])
async def get_split_history(user: dict = Depends(current_user)):
    return await _get_split_history(user["id"])
