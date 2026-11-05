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


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    weight_kg: float = Field(gt=20, le=500)
    height_cm: float = Field(gt=50, le=260)


class OkResponse(BaseModel):
    ok: bool = True
