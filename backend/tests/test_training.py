"""
Unit tests for lib/training.py
Covers: epley, epley_for_equipment, working_sets, set_volume, workout_volume,
        completed_set_count, duration_min, exercise_bests, detect_new_prs.
"""
import uuid
from datetime import datetime, timezone

import pytest

from lib.training import (
    detect_new_prs,
    epley,
    epley_for_equipment,
    exercise_bests,
    completed_set_count,
    duration_min,
    set_volume,
    working_sets,
    workout_volume,
)
from models.workout import Workout, WorkoutExercise, WorkoutSet


# ── Helpers ───────────────────────────────────────────────────────────────────

def _uid() -> str:
    return str(uuid.uuid4())


def _set(
    weight: float | None = 60.0,
    reps: int | None = 8,
    completed: bool = True,
    set_type: str = "N",
) -> WorkoutSet:
    return WorkoutSet(uid=_uid(), weight=weight, reps=reps, completed=completed, set_type=set_type)


def _ex(exercise_id: str = "ex1", equipment: str | None = "Barbell", sets: list[WorkoutSet] | None = None) -> WorkoutExercise:
    return WorkoutExercise(
        uid=_uid(),
        exercise_id=exercise_id,
        exercise_name="Bench Press",
        muscle_group="Chest",
        equipment=equipment,
        sets=sets or [_set()],
    )


def _workout(
    exercises: list[WorkoutExercise] | None = None,
    date: str = "2026-10-01",
    status: str = "completed",
    started: str = "2026-10-01T18:00:00+00:00",
    finished: str | None = "2026-10-01T19:00:00+00:00",
    _empty_exercises: bool = False,
) -> Workout:
    if _empty_exercises:
        ex_list: list[WorkoutExercise] = []
    else:
        ex_list = exercises if exercises is not None else [_ex()]
    return Workout(
        id=_uid(),
        name="Test Workout",
        date=date,
        status=status,
        exercises=ex_list,
        started_at=datetime.fromisoformat(started),
        finished_at=datetime.fromisoformat(finished) if finished else None,
    )


# ── epley ─────────────────────────────────────────────────────────────────────

class TestEpley:
    def test_1rm_single_rep_returns_weight(self):
        assert epley(100.0, 1) == 100.0

    def test_standard_8_reps(self):
        # 60 × (1 + 8/30) = 60 × 1.2667 = 76.0
        assert epley(60.0, 8) == 76.0

    def test_zero_weight_returns_zero(self):
        assert epley(0.0, 10) == 0.0

    def test_none_weight_returns_zero(self):
        assert epley(None, 10) == 0.0

    def test_none_reps_returns_zero(self):
        assert epley(60.0, None) == 0.0

    def test_zero_reps_returns_zero(self):
        assert epley(60.0, 0) == 0.0

    def test_negative_reps_returns_zero(self):
        assert epley(60.0, -1) == 0.0

    def test_result_rounded_to_one_decimal(self):
        # 50 × (1 + 5/30) = 50 × 1.1667 = 58.3
        result = epley(50.0, 5)
        assert isinstance(result, float)
        assert result == round(result, 1)


class TestEpleyForEquipment:
    def test_barbell_uses_epley(self):
        assert epley_for_equipment(100.0, 1, "Barbell") == 100.0

    def test_resistance_band_no_weight_returns_zero(self):
        assert epley_for_equipment(None, 10, "Resistance Band") == 0.0

    def test_resistance_band_with_weight_uses_epley(self):
        assert epley_for_equipment(20.0, 8, "Resistance Band") == epley(20.0, 8)

    def test_none_equipment_uses_epley(self):
        assert epley_for_equipment(60.0, 8, None) == epley(60.0, 8)


# ── working_sets ──────────────────────────────────────────────────────────────

class TestWorkingSets:
    def test_completed_normal_set_counts(self):
        ex = _ex(sets=[_set(completed=True, set_type="N")])
        assert len(working_sets(ex)) == 1

    def test_warm_up_set_excluded(self):
        ex = _ex(sets=[_set(completed=True, set_type="W")])
        assert working_sets(ex) == []

    def test_incomplete_set_excluded(self):
        ex = _ex(sets=[_set(completed=False, set_type="N")])
        assert working_sets(ex) == []

    def test_set_without_reps_excluded(self):
        ex = _ex(sets=[_set(reps=None, completed=True, set_type="N")])
        assert working_sets(ex) == []

    def test_duration_only_set_counts(self):
        """HIGH-3: A set with duration_seconds but no reps should count."""
        from datetime import timedelta
        s = WorkoutSet(uid=_uid(), weight=None, reps=None, completed=True, set_type="N", duration_seconds=60)
        ex = _ex(sets=[s])
        assert len(working_sets(ex)) == 1

    def test_duration_zero_excluded(self):
        """A set with duration_seconds=0 should not count as a working set."""
        s = WorkoutSet(uid=_uid(), weight=None, reps=None, completed=True, set_type="N", duration_seconds=0)
        ex = _ex(sets=[s])
        assert working_sets(ex) == []

    def test_mixed_reps_and_duration(self):
        """An exercise with both rep-based and duration-based sets counts both."""
        dur_set = WorkoutSet(uid=_uid(), weight=None, reps=None, completed=True, set_type="N", duration_seconds=45)
        rep_set = _set(weight=60, reps=8, completed=True, set_type="N")
        ex = _ex(sets=[dur_set, rep_set])
        assert len(working_sets(ex)) == 2

    def test_drop_set_counts(self):
        ex = _ex(sets=[_set(completed=True, set_type="D")])
        assert len(working_sets(ex)) == 1

    def test_failure_set_counts(self):
        ex = _ex(sets=[_set(completed=True, set_type="F")])
        assert len(working_sets(ex)) == 1

    def test_mixed_sets(self):
        ex = _ex(sets=[
            _set(completed=True, set_type="W"),   # excluded
            _set(completed=True, set_type="N"),   # included
            _set(completed=False, set_type="N"),  # excluded
            _set(reps=None, completed=True),       # excluded
            _set(completed=True, set_type="D"),   # included
        ])
        assert len(working_sets(ex)) == 2


# ── volume ────────────────────────────────────────────────────────────────────

class TestVolume:
    def test_set_volume(self):
        s = _set(weight=60.0, reps=8)
        assert set_volume(s) == 480.0

    def test_set_volume_none_weight(self):
        s = _set(weight=None, reps=8)
        assert set_volume(s) == 0.0

    def test_set_volume_none_reps(self):
        s = _set(weight=60.0, reps=None)
        assert set_volume(s) == 0.0

    def test_workout_volume_sums_working_sets(self):
        # 2 working sets × (60 × 8 = 480) = 960
        # 1 warm-up (should be excluded)
        ex = _ex(sets=[
            _set(weight=30.0, reps=8, set_type="W"),  # excluded
            _set(weight=60.0, reps=8),
            _set(weight=60.0, reps=8),
        ])
        w = _workout(exercises=[ex])
        assert workout_volume(w) == 960.0

    def test_workout_volume_empty_exercises(self):
        w = _workout(_empty_exercises=True)
        assert workout_volume(w) == 0.0

    def test_completed_set_count(self):
        ex = _ex(sets=[
            _set(set_type="W", completed=True),  # warm-up excluded
            _set(completed=True),
            _set(completed=False),               # incomplete excluded
            _set(reps=None, completed=True),     # no reps excluded
        ])
        w = _workout(exercises=[ex])
        assert completed_set_count(w) == 1


# ── duration_min ──────────────────────────────────────────────────────────────

class TestDurationMin:
    def test_60_minute_workout(self):
        w = _workout(started="2026-10-01T18:00:00+00:00", finished="2026-10-01T19:00:00+00:00")
        assert duration_min(w) == 60

    def test_rounds_to_nearest_minute(self):
        from datetime import timedelta
        # 90-second workout — rounds to 2 min (90/60 = 1.5 → rounds to 2)
        base = datetime(2026, 10, 1, 18, 0, 0, tzinfo=timezone.utc)
        ex = _ex()
        w = Workout(
            id=_uid(), name="T", date="2026-10-01", status="completed",
            exercises=[ex],
            started_at=base,
            finished_at=base + timedelta(seconds=90),
        )
        assert duration_min(w) == 2

    def test_minimum_one_minute(self):
        # Very short workout (10 s) → still returns 1
        w = _workout(started="2026-10-01T18:00:00+00:00", finished="2026-10-01T18:00:10+00:00")
        assert duration_min(w) == 1

    def test_no_finished_at_returns_none(self):
        w = _workout(finished=None, status="active")
        assert duration_min(w) is None


# ── exercise_bests ────────────────────────────────────────────────────────────

class TestExerciseBests:
    def test_single_workout_records_best(self):
        ex = _ex(exercise_id="ex1", sets=[_set(weight=100.0, reps=5)])
        w = _workout(exercises=[ex])
        bests = exercise_bests([w])
        assert "ex1" in bests
        assert bests["ex1"]["best_weight"] == 100.0

    def test_later_workout_supersedes(self):
        ex1 = _ex(exercise_id="ex1", sets=[_set(weight=100.0, reps=5)])
        ex2 = _ex(exercise_id="ex1", sets=[_set(weight=110.0, reps=5)])
        w1 = _workout(exercises=[ex1], date="2026-10-01")
        w2 = _workout(exercises=[ex2], date="2026-10-08")
        bests = exercise_bests([w1, w2])
        assert bests["ex1"]["best_weight"] == 110.0
        assert bests["ex1"]["best_weight_date"] == "2026-10-08"

    def test_ties_resolved_by_reps(self):
        # Same weight but more reps on second workout
        ex1 = _ex(exercise_id="ex1", sets=[_set(weight=100.0, reps=5)])
        ex2 = _ex(exercise_id="ex1", sets=[_set(weight=100.0, reps=8)])
        w1 = _workout(exercises=[ex1], date="2026-10-01")
        w2 = _workout(exercises=[ex2], date="2026-10-08")
        bests = exercise_bests([w1, w2])
        assert bests["ex1"]["best_weight_reps"] == 8

    def test_warm_up_sets_excluded(self):
        ex = _ex(exercise_id="ex1", sets=[
            _set(weight=200.0, reps=5, set_type="W"),   # warm-up — must NOT be best
            _set(weight=100.0, reps=5, set_type="N"),
        ])
        w = _workout(exercises=[ex])
        bests = exercise_bests([w])
        assert bests["ex1"]["best_weight"] == 100.0

    def test_e1rm_tracked_separately(self):
        # 5 reps at 100 → e1RM = 100 × (1 + 5/30) ≈ 116.7
        # 1 rep at 110 → e1RM = 110
        ex1 = _ex(exercise_id="ex1", sets=[_set(weight=100.0, reps=5)])
        ex2 = _ex(exercise_id="ex1", sets=[_set(weight=110.0, reps=1)])
        w1 = _workout(exercises=[ex1], date="2026-10-01")
        w2 = _workout(exercises=[ex2], date="2026-10-08")
        bests = exercise_bests([w1, w2])
        # 5@100 e1RM ≈ 116.7 is higher
        assert bests["ex1"]["best_e1rm"] == pytest.approx(116.7, abs=0.2)
        assert bests["ex1"]["best_weight"] == 110.0  # but weight PR is 110


# ── detect_new_prs ─────────────────────────────────────────────────────────────

class TestDetectNewPRs:
    def _prior(self, exercise_id: str = "ex1", best_weight: float = 100.0, best_e1rm: float = 110.0) -> dict:
        return {
            exercise_id: {
                "exercise_id": exercise_id,
                "exercise_name": "Bench Press",
                "muscle_group": "Chest",
                "equipment": "Barbell",
                "best_weight": best_weight,
                "best_weight_reps": 5,
                "best_weight_date": "2026-09-01",
                "best_e1rm": best_e1rm,
                "best_e1rm_date": "2026-09-01",
                "weight_note": "total barbell load",
            }
        }

    def test_weight_pr_detected(self):
        ex = _ex(exercise_id="ex1", sets=[_set(weight=105.0, reps=5)])
        w = _workout(exercises=[ex])
        prs = detect_new_prs(self._prior("ex1", best_weight=100.0, best_e1rm=110.0), w)
        weight_prs = [p for p in prs if p.kind == "weight"]
        assert len(weight_prs) == 1
        assert weight_prs[0].value == 105.0

    def test_no_pr_when_below_best(self):
        # 95 kg × 5 reps → e1RM ≈ 110.8; set prior e1RM high enough to avoid a PR
        ex = _ex(exercise_id="ex1", sets=[_set(weight=95.0, reps=5)])
        w = _workout(exercises=[ex])
        prs = detect_new_prs(self._prior("ex1", best_weight=100.0, best_e1rm=115.0), w)
        assert prs == []

    def test_e1rm_pr_detected(self):
        # 8 reps @ 90 → e1RM = 90 × (1 + 8/30) = 114.0 > 110
        ex = _ex(exercise_id="ex1", sets=[_set(weight=90.0, reps=8)])
        w = _workout(exercises=[ex])
        prs = detect_new_prs(self._prior("ex1", best_weight=100.0, best_e1rm=110.0), w)
        e1rm_prs = [p for p in prs if p.kind == "e1rm"]
        assert len(e1rm_prs) == 1

    def test_first_ever_exercise_not_flagged(self):
        # Exercise not in prior → intentional UX decision: no PR for first time
        ex = _ex(exercise_id="new_exercise", sets=[_set(weight=100.0, reps=5)])
        w = _workout(exercises=[ex])
        prs = detect_new_prs({}, w)
        assert prs == []

    def test_warm_up_sets_not_counted(self):
        # Only warm-up set — should produce no PRs
        ex = _ex(exercise_id="ex1", sets=[_set(weight=200.0, reps=5, set_type="W")])
        w = _workout(exercises=[ex])
        prs = detect_new_prs(self._prior("ex1", best_weight=100.0, best_e1rm=110.0), w)
        assert prs == []

    def test_multiple_exercises_prs(self):
        ex1 = _ex(exercise_id="ex1", sets=[_set(weight=105.0, reps=5)])
        ex2 = _ex(exercise_id="ex2", sets=[_set(weight=55.0, reps=5)])
        w = _workout(exercises=[ex1, ex2])
        prior = {
            **self._prior("ex1", best_weight=100.0, best_e1rm=110.0),
            **self._prior("ex2", best_weight=50.0, best_e1rm=55.0),
        }
        prs = detect_new_prs(prior, w)
        pr_ids = {p.exercise_id for p in prs}
        assert "ex1" in pr_ids
        assert "ex2" in pr_ids
