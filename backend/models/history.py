"""Models for workout consistency and historical schedule tracking."""
from __future__ import annotations

from pydantic import BaseModel


# ─── Split history snapshot ───────────────────────────────────────────────────

class SplitHistoryDay(BaseModel):
    weekday: int          # 0 = Monday … 6 = Sunday
    template_id: str | None = None
    template_name: str | None = None


class SplitHistoryRecord(BaseModel):
    """
    One entry per split configuration.
    effective_from = ISO date the split became active.
    effective_to   = ISO date the split was replaced (None = still active).
    """
    effective_from: str
    effective_to: str | None = None
    split_name: str
    days: list[SplitHistoryDay]


# ─── Calendar day ─────────────────────────────────────────────────────────────

class CalendarWorkoutSummary(BaseModel):
    id: str
    name: str
    volume: float
    completed_sets: int
    duration_min: int | None


class CalendarDay(BaseModel):
    date: str                                   # YYYY-MM-DD
    status: str                                 # "done" | "missed" | "rest" | "today" | "future" | "none"
    is_scheduled: bool
    is_rest: bool
    scheduled_template_name: str | None = None
    workouts: list[CalendarWorkoutSummary] = []


class CalendarResponse(BaseModel):
    year: int
    month: int
    days: list[CalendarDay]


# ─── All-time stats ───────────────────────────────────────────────────────────

class ConsistencyStats(BaseModel):
    # Workout counts
    total_sessions: int
    total_workout_days: int          # unique calendar dates
    this_week_sessions: int
    this_month_sessions: int
    this_year_sessions: int

    # Streaks (consecutive calendar days with ≥1 completed workout)
    current_streak: int
    longest_streak: int

    # Consistency (only counts days where a workout was scheduled AND the day has passed)
    weekly_consistency_pct: float    # current calendar week
    monthly_consistency_pct: float   # current calendar month
    all_time_consistency_pct: float  # lifetime

    # Breakdown
    scheduled_days_total: int        # all past scheduled (non-rest) days since first workout
    completed_scheduled_days: int
    missed_scheduled_days: int
