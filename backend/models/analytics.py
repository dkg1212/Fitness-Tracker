from pydantic import BaseModel


class WeeklyVolume(BaseModel):
    week_start: str
    volume: float
    workouts: int


class MuscleWorkload(BaseModel):
    muscle_group: str
    sets: int
    volume: float


class PersonalRecord(BaseModel):
    exercise_id: str
    exercise_name: str
    muscle_group: str
    best_weight: float
    best_weight_reps: int
    best_weight_date: str
    best_e1rm: float
    best_e1rm_date: str


class AnalyticsSummary(BaseModel):
    total_workouts: int
    this_week_volume: float
    this_week_workouts: int
    week_streak: int
    weekly_volume: list[WeeklyVolume]
    muscle_workload: list[MuscleWorkload]
    prs: list[PersonalRecord]


class ExerciseProgressPoint(BaseModel):
    date: str
    top_weight: float
    e1rm: float
    volume: float
    best_set: str


class ExerciseProgress(BaseModel):
    exercise_id: str
    exercise_name: str
    points: list[ExerciseProgressPoint]


# Sub-muscle breakdown models
class SubMuscleWorkload(BaseModel):
    muscle: str
    sets: float  # float because secondary muscles use 0.5x credit
    volume: float


class SubMuscleBreakdown(BaseModel):
    primary: list[SubMuscleWorkload]
    secondary: list[SubMuscleWorkload]
