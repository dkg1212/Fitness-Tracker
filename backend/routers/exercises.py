import re

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import current_user
from lib.db import db
from models.exercise import Exercise, ExerciseCreate

router = APIRouter(prefix="/exercises", tags=["exercises"])


def _visible(user_id: str) -> dict:
    return {"$or": [{"is_custom": False}, {"user_id": user_id}]}


@router.get("", response_model=list[Exercise])
async def list_exercises(user: dict = Depends(current_user)):
    docs = await db.exercises.find(_visible(user["id"]), {"_id": 0}).sort("name", 1).to_list(2000)
    return [Exercise(**d) for d in docs]


@router.post("", response_model=Exercise, status_code=201)
async def create_exercise(body: ExerciseCreate, user: dict = Depends(current_user)):
    name = body.name.strip()
    dup = await db.exercises.find_one(
        {"$and": [_visible(user["id"]), {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}]}
    )
    if dup:
        raise HTTPException(status_code=409, detail="An exercise with this name already exists")
    ex = Exercise(name=name, muscle_group=body.muscle_group, equipment=body.equipment, is_custom=True)
    await db.exercises.insert_one({**ex.model_dump(), "user_id": user["id"]})
    return ex


@router.delete("/{id}", status_code=204)
async def delete_exercise(id: str, user: dict = Depends(current_user)):
    res = await db.exercises.delete_one({"id": id, "user_id": user["id"], "is_custom": True})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom exercise not found")
    return Response(status_code=204)
