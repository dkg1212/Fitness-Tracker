from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from lib.auth import current_user
from lib.dates import today_iso
from lib.db import db
from lib.exercise_meta import EXERCISE_META
from lib.training import epley, exercise_bests, set_volume, working_sets, workout_volume
from models.analytics import (
    AnalyticsSummary,
    ExerciseProgress,
    ExerciseProgressPoint,
    MuscleWorkload,
    PersonalRecord,
    SubMuscleBreakdown,
    SubMuscleWorkload,
    WeeklyVolume,
)
from models.workout import Workout

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


async def _completed(user_id: str) -> list[Workout]:
    docs = await db.workouts.find({"user_id": user_id, "status": "completed"}, {"_id": 0}).sort("date", 1).to_list(5000)
    return [Workout(**d) for d in docs]


def _fmt_num(v: float) -> str:
    return f"{v:g}"


@router.get("/summary", response_model=AnalyticsSummary)
async def summary(user: dict = Depends(current_user)):
    workouts = await _completed(user["id"])
    today = date.fromisoformat(today_iso())
    this_week = _week_start(today)

    by_week: dict[date, list[Workout]] = defaultdict(list)
    for w in workouts:
        by_week[_week_start(date.fromisoformat(w.date))].append(w)

    weekly = []
    for i in range(11, -1, -1):
        ws = this_week - timedelta(weeks=i)
        items = by_week.get(ws, [])
        weekly.append(WeeklyVolume(week_start=ws.isoformat(), volume=round(sum(workout_volume(w) for w in items), 1),
                                   workouts=len(items)))

    streak = 0
    cursor = this_week if by_week.get(this_week) else this_week - timedelta(weeks=1)
    while by_week.get(cursor):
        streak += 1
        cursor -= timedelta(weeks=1)

    cutoff = (today - timedelta(days=27)).isoformat()
    sets_by_mg: dict[str, int] = defaultdict(int)
    vol_by_mg: dict[str, float] = defaultdict(float)
    for w in workouts:
        if w.date < cutoff:
            continue
        for ex in w.exercises:
            for s in working_sets(ex):
                sets_by_mg[ex.muscle_group] += 1
                vol_by_mg[ex.muscle_group] += set_volume(s)
    workload = sorted(
        (MuscleWorkload(muscle_group=mg, sets=n, volume=round(vol_by_mg[mg], 1)) for mg, n in sets_by_mg.items()),
        key=lambda m: m.sets,
        reverse=True,
    )

    prs = sorted(
        (PersonalRecord(**b) for b in exercise_bests(workouts).values()),
        key=lambda p: p.best_e1rm,
        reverse=True,
    )
    current = by_week.get(this_week, [])
    return AnalyticsSummary(
        total_workouts=len(workouts),
        this_week_volume=round(sum(workout_volume(w) for w in current), 1),
        this_week_workouts=len(current),
        week_streak=streak,
        weekly_volume=weekly,
        muscle_workload=workload,
        prs=prs,
    )


@router.get("/exercise/{exercise_id}", response_model=ExerciseProgress)
async def exercise_progress(exercise_id: str, user: dict = Depends(current_user)):
    workouts = await _completed(user["id"])
    name = ""
    points: list[ExerciseProgressPoint] = []
    for w in workouts:
        sets = [s for ex in w.exercises if ex.exercise_id == exercise_id for s in working_sets(ex)]
        if not sets:
            continue
        name = next(ex.exercise_name for ex in w.exercises if ex.exercise_id == exercise_id)
        best = max(sets, key=lambda s: epley(s.weight, s.reps))
        points.append(
            ExerciseProgressPoint(
                date=w.date,
                top_weight=max((s.weight or 0) for s in sets),
                e1rm=epley(best.weight, best.reps),
                volume=round(sum(set_volume(s) for s in sets), 1),
                best_set=f"{_fmt_num(best.weight or 0)} × {best.reps}",
            )
        )
    if not name:
        doc = await db.exercises.find_one({"id": exercise_id}, {"_id": 0, "name": 1})
        name = doc["name"] if doc else ""
    return ExerciseProgress(exercise_id=exercise_id, exercise_name=name, points=points)


@router.get("/sub-muscle", response_model=SubMuscleBreakdown)
async def sub_muscle_breakdown(user: dict = Depends(current_user)):
    """
    Count primary and secondary working-set volume by detailed sub-muscle for the last 4 weeks.

    Rules:
    - Only completed, non-warmup sets with reps are counted (same definition as workload/volume).
    - Primary muscles get FULL set/volume credit.
    - Secondary muscles get 0.5 set credit and 0.5 volume credit — they are helpers, not the target.
    - Exercises with no metadata in EXERCISE_META are attributed to their main muscle_group only.
    - Existing workout/PR/volume calculations are not touched.
    """
    workouts = await _completed(user["id"])
    today = date.fromisoformat(today_iso())
    cutoff = (today - timedelta(days=27)).isoformat()

    primary_sets: dict[str, int] = defaultdict(int)
    primary_vol: dict[str, float] = defaultdict(float)
    secondary_sets: dict[str, float] = defaultdict(float)
    secondary_vol: dict[str, float] = defaultdict(float)

    for w in workouts:
        if w.date < cutoff:
            continue
        for ex in w.exercises:
            meta = EXERCISE_META.get(ex.exercise_name)
            ws = working_sets(ex)
            if not ws:
                continue
            n_sets = len(ws)
            vol = sum(set_volume(s) for s in ws)

            if meta:
                ex_type, pm, sm = meta
                # Primary muscles — full credit
                for muscle in pm:
                    primary_sets[muscle] += n_sets
                    primary_vol[muscle] += vol
                # Secondary muscles — half credit (assisting, not primary target)
                for muscle in sm:
                    secondary_sets[muscle] += n_sets * 0.5
                    secondary_vol[muscle] += vol * 0.5
            else:
                # No detailed meta — fall back to main muscle group
                primary_sets[ex.muscle_group] += n_sets
                primary_vol[ex.muscle_group] += vol

    primary_out = sorted(
        [SubMuscleWorkload(muscle=m, sets=n, volume=round(primary_vol[m], 1)) for m, n in primary_sets.items()],
        key=lambda x: x.sets,
        reverse=True,
    )
    secondary_out = sorted(
        [SubMuscleWorkload(muscle=m, sets=round(n, 1), volume=round(secondary_vol[m], 1)) for m, n in secondary_sets.items()
         if m not in primary_sets],  # exclude muscles already counted as primary
        key=lambda x: x.sets,
        reverse=True,
    )

    return SubMuscleBreakdown(primary=primary_out, secondary=secondary_out)
