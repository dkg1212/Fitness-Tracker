import uuid
from typing import Literal

from pydantic import BaseModel, Field

from models.common import UtcDatetime, utcnow

SetType = Literal["W", "N", "D", "F"]  # warm-up, normal, drop, failure


def _uid() -> str:
    return str(uuid.uuid4())


class WorkoutSet(BaseModel):
    uid: str = Field(default_factory=_uid)
    set_type: SetType = "N"
    weight: float | None = Field(default=None, ge=0, le=1000)
    reps: int | None = Field(default=None, ge=0, le=1000)
    rpe: float | None = Field(default=None, ge=0, le=10)
    rir: float | None = Field(default=None, ge=0, le=10)
    completed: bool = False


class WorkoutExercise(BaseModel):
    uid: str = Field(default_factory=_uid)
    exercise_id: str
    exercise_name: str
    muscle_group: str
    notes: str = Field(default="", max_length=2000)
    rest_seconds: int = Field(default=120, ge=0, le=900)
    effort_mode: Literal["rpe", "rir"] = "rpe"
    sets: list[WorkoutSet] = Field(default_factory=list)


class WorkoutUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    notes: str = Field(default="", max_length=4000)
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    exercises: list[WorkoutExercise] = Field(default_factory=list)


class WorkoutStart(BaseModel):
    template_id: str | None = None
    name: str | None = Field(default=None, max_length=80)


class Workout(BaseModel):
    id: str = Field(default_factory=_uid)
    name: str
    date: str
    status: Literal["active", "completed"] = "active"
    template_id: str | None = None
    notes: str = ""
    exercises: list[WorkoutExercise] = Field(default_factory=list)
    started_at: UtcDatetime = Field(default_factory=utcnow)
    finished_at: UtcDatetime | None = None
    updated_at: UtcDatetime = Field(default_factory=utcnow)


class WorkoutSummary(BaseModel):
    id: str
    name: str
    date: str
    status: Literal["active", "completed"]
    started_at: UtcDatetime
    finished_at: UtcDatetime | None
    duration_min: int | None
    volume: float
    completed_sets: int
    exercise_names: list[str]
    muscle_groups: list[str]


class PRRecord(BaseModel):
    exercise_id: str
    exercise_name: str
    kind: Literal["weight", "e1rm"]
    value: float
    weight: float
    reps: int


class FinishResult(BaseModel):
    workout: Workout
    new_prs: list[PRRecord]
    volume: float
    completed_sets: int
    duration_min: int
