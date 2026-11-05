import uuid

from pydantic import BaseModel, Field

from models.common import UtcDatetime, utcnow


class TemplateExercise(BaseModel):
    exercise_id: str
    exercise_name: str
    muscle_group: str
    target_sets: int = Field(default=3, ge=1, le=10)
    target_reps: str = Field(default="8-12", max_length=20)
    rest_seconds: int = Field(default=120, ge=0, le=900)


class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    notes: str = Field(default="", max_length=1000)
    exercises: list[TemplateExercise] = Field(default_factory=list)


class Template(TemplateIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: UtcDatetime = Field(default_factory=utcnow)
