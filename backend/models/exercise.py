import uuid
from typing import Literal

from pydantic import BaseModel, Field

MuscleGroup = Literal[
    "Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Glutes", "Biceps", "Triceps", "Core", "Calves"
]
Equipment = Literal["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Kettlebell"]


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    muscle_group: MuscleGroup
    equipment: Equipment


class Exercise(ExerciseCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    is_custom: bool = False
