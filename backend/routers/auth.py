from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import current_user
from lib.db import db
from models.auth import OkResponse, ProfileUpdate, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/logout", response_model=OkResponse)
async def logout(response: Response):
    return OkResponse()


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(current_user)):
    return UserPublic(**user)


@router.put("/profile", response_model=UserPublic)
async def update_profile(body: ProfileUpdate, user: dict = Depends(current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name is required")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"name": name, "weight_kg": body.weight_kg, "height_cm": body.height_cm, "sex": body.sex}},
    )
    return UserPublic(id=user["id"], email=user["email"], name=name, weight_kg=body.weight_kg, height_cm=body.height_cm, sex=body.sex)
