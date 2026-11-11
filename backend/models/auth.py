from typing import Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1, max_length=200)


class RegisterRequest(LoginRequest):
    name: str = Field(min_length=1, max_length=60)
    weight_kg: float = Field(gt=20, le=500)
    height_cm: float = Field(gt=50, le=260)


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    weight_kg: float | None = None
    height_cm: float | None = None
    sex: Literal["male", "female"] | None = None
    # Onboarding fields — backward-compatible defaults for existing users
    onboarding_completed: bool = False
    onboarding_completed_at: str | None = None
    onboarding_version: int = 0


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    weight_kg: float = Field(gt=20, le=500)
    height_cm: float = Field(gt=50, le=260)
    # sex is optional so that the frontend can submit the form before the user
    # has selected a value (BUG-11 — previously a missing sex caused a 422).
    sex: Literal["male", "female"] | None = None


class OkResponse(BaseModel):
    ok: bool = True
