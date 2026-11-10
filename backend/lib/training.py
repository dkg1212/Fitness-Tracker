"""Training math: volume, estimated 1RM (Epley), per-exercise bests.

Equipment conventions
─────────────────────
• Barbell / Smith Machine / Plate-Loaded Machine
      weight = total load (bar + plates)
      e1RM and volume use total load
• Dumbbell / Kettlebell
      weight = per-dumbbell weight (never doubled)
      e1RM and volume use the per-dumbbell value as recorded
• Cable / Machine (selectorised)
      weight = stack weight as selected
• Bodyweight
      weight = effective load stored by the UI:
        - normal BW:   bodyweight (or 0/None if not entered)
        - weighted BW: bodyweight + added weight
        - assisted BW: bodyweight − assistance
• Resistance Band
      weight = resistance value if numeric, else None
      e1RM is NOT calculated for band-only exercises (returns 0)

For backward compatibility, existing sets without loading_inputs just
use weight as-is; nothing is reinterpreted.
"""

from models.workout import Workout, WorkoutExercise, WorkoutSet, WorkoutSummary

# Equipment types where e1RM calculation is meaningful
_E1RM_SUPPORTED = {
    "Barbell", "Smith Machine", "Dumbbell", "Cable", "Machine",
    "Plate-Loaded Machine", "Kettlebell", "Bodyweight",
}

# Equipment types where the conventional "per-hand/per-dumbbell" labelling applies
_PER_HAND_EQUIPMENT = {"Dumbbell", "Kettlebell"}


def epley(weight: float | None, reps: int | None) -> float:
    if not weight or not reps or reps <= 0:
        return 0.0
    if reps == 1:
        return round(weight, 1)
    return round(weight * (1 + reps / 30), 1)


def epley_for_equipment(weight: float | None, reps: int | None, equipment: str | None) -> float:
    """Epley, but suppressed for Resistance Band exercises without a numeric load."""
    if equipment == "Resistance Band" and not weight:
        return 0.0
    return epley(weight, reps)


def weight_note_for(equipment: str | None) -> str:
    """Return a human-readable label for what `weight` means for the given equipment."""
    notes = {
        "Barbell": "total barbell load",
        "Smith Machine": "total load",
        "Dumbbell": "per dumbbell",
        "Cable": "stack weight",
        "Machine": "stack weight",
        "Plate-Loaded Machine": "total load",
        "Bodyweight": "effective load",
        "Kettlebell": "kettlebell weight",
        "Resistance Band": "band resistance",
    }
    return notes.get(equipment or "", "")


def working_sets(ex: WorkoutExercise) -> list[WorkoutSet]:
    """Completed, non-warm-up sets with reps logged — the ones that count."""
    return [s for s in ex.sets if s.completed and s.set_type != "W" and s.reps]


def set_volume(s: WorkoutSet) -> float:
    return (s.weight or 0) * (s.reps or 0)


def workout_volume(w: Workout) -> float:
    return round(sum(set_volume(s) for ex in w.exercises for s in working_sets(ex)), 1)


def completed_set_count(w: Workout) -> int:
    return sum(len(working_sets(ex)) for ex in w.exercises)


def duration_min(w: Workout) -> int | None:
    if not w.finished_at:
        return None
    return max(1, round((w.finished_at - w.started_at).total_seconds() / 60))


def summarize(w: Workout) -> WorkoutSummary:
    groups: list[str] = []
    for ex in w.exercises:
        if ex.muscle_group not in groups:
            groups.append(ex.muscle_group)
    return WorkoutSummary(
        id=w.id,
        name=w.name,
        date=w.date,
        status=w.status,
        started_at=w.started_at,
        finished_at=w.finished_at,
        duration_min=duration_min(w),
        volume=workout_volume(w),
        completed_sets=completed_set_count(w),
        exercise_names=[ex.exercise_name for ex in w.exercises],
        muscle_groups=groups,
    )


def exercise_bests(workouts: list[Workout]) -> dict[str, dict]:
    """exercise_id -> best weight / best e1RM across the given workouts (oldest first wins ties)."""
    bests: dict[str, dict] = {}
    for w in sorted(workouts, key=lambda x: (x.date, x.started_at)):
        for ex in w.exercises:
            equipment = ex.equipment  # may be None for legacy records
            for s in working_sets(ex):
                weight = s.weight or 0
                e1 = epley_for_equipment(weight, s.reps, equipment)
                b = bests.setdefault(
                    ex.exercise_id,
                    {
                        "exercise_id": ex.exercise_id,
                        "exercise_name": ex.exercise_name,
                        "muscle_group": ex.muscle_group,
                        "equipment": equipment,
                        "best_weight": -1.0,
                        "best_weight_reps": 0,
                        "best_weight_date": w.date,
                        "best_e1rm": -1.0,
                        "best_e1rm_date": w.date,
                        "weight_note": s.weight_note or weight_note_for(equipment),
                    },
                )
                if weight > b["best_weight"] or (weight == b["best_weight"] and (s.reps or 0) > b["best_weight_reps"]):
                    b.update(
                        best_weight=weight,
                        best_weight_reps=s.reps or 0,
                        best_weight_date=w.date,
                        weight_note=s.weight_note or weight_note_for(equipment),
                    )
                if e1 > b["best_e1rm"]:
                    b.update(best_e1rm=e1, best_e1rm_date=w.date)
    return bests
