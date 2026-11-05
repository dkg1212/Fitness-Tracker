from pydantic import BaseModel, Field

from models.template import Template


class SplitDay(BaseModel):
    weekday: int = Field(ge=0, le=6)  # 0 = Monday
    template_id: str | None = None  # None = rest day
    template_name: str | None = None  # resolved on read


class SplitIn(BaseModel):
    name: str = Field(default="My Split", min_length=1, max_length=60)
    days: list[SplitDay] = Field(min_length=7, max_length=7)


class Split(SplitIn):
    pass


class TodayInfo(BaseModel):
    date: str
    weekday: int
    template: Template | None
    is_rest: bool
    active_workout_id: str | None
    split: Split
