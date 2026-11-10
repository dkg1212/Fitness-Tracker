import uuid
from typing import Literal

from pydantic import BaseModel, Field

MuscleGroup = Literal[
    "Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Glutes", "Biceps", "Triceps", "Core", "Calves"
]
Equipment = Literal[
    "Barbell",
    "Smith Machine",
    "Dumbbell",
    "Cable",
    "Machine",          # selectorised / weight-stack machine
    "Plate-Loaded Machine",
    "Bodyweight",
    "Kettlebell",
    "Resistance Band",
]
ExerciseType = Literal["Compound", "Isolation"]


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    muscle_group: MuscleGroup
    equipment: Equipment
    # Optional classification — custom exercises can specify these
    exercise_type: ExerciseType | None = None
    primary_muscles: list[str] = Field(default_factory=list)
    secondary_muscles: list[str] = Field(default_factory=list)


class ExerciseUpdate(BaseModel):
    """Used for editing custom exercises."""
    name: str = Field(min_length=1, max_length=80)
    muscle_group: MuscleGroup
    equipment: Equipment
    exercise_type: ExerciseType | None = None
    primary_muscles: list[str] = Field(default_factory=list)
    secondary_muscles: list[str] = Field(default_factory=list)


class Exercise(ExerciseCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_custom: bool = False
    exercise_type: ExerciseType | None = None
    primary_muscles: list[str] = Field(default_factory=list)
    secondary_muscles: list[str] = Field(default_factory=list)
