from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import current_user
from lib.db import db
from models.auth import OkResponse, ProfileUpdate, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])

# Current onboarding schema version — bump this if you add new tour steps
ONBOARDING_VERSION = 1


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
    update_fields: dict = {"name": name, "weight_kg": body.weight_kg, "height_cm": body.height_cm}
    # Only write sex when the client supplied a value; never overwrite an existing
    # sex choice with null just because the user didn't re-select it (BUG-11).
    if body.sex is not None:
        update_fields["sex"] = body.sex
    await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return UserPublic(**updated)


@router.post("/onboarding/complete", response_model=UserPublic)
async def complete_onboarding(user: dict = Depends(current_user)):
    """Mark onboarding as completed for the current user."""
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "onboarding_completed": True,
            "onboarding_completed_at": now,
            "onboarding_version": ONBOARDING_VERSION,
        }},
    )
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return UserPublic(**updated)


@router.post("/onboarding/reset", response_model=UserPublic)
async def reset_onboarding(user: dict = Depends(current_user)):
    """Reset onboarding status so the tour can be replayed."""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "onboarding_completed": False,
            "onboarding_completed_at": None,
            "onboarding_version": 0,
        }},
    )
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return UserPublic(**updated)
