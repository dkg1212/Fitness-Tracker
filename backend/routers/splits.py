from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.dates import today_iso
from lib.db import db
from models.split import Split, SplitDay, SplitIn, TodayInfo
from models.template import Template

router = APIRouter(tags=["split"])


async def _templates_by_id(user_id: str) -> dict[str, Template]:
    docs = await db.templates.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    return {d["id"]: Template(**d) for d in docs}


async def load_split(user_id: str, templates: dict[str, Template]) -> Split:
    doc = await db.splits.find_one({"user_id": user_id}, {"_id": 0})
    stored = {d["weekday"]: d.get("template_id") for d in (doc or {}).get("days", [])}
    days = []
    for wd in range(7):
        tid = stored.get(wd)
        t = templates.get(tid) if tid else None
        days.append(SplitDay(weekday=wd, template_id=t.id if t else None, template_name=t.name if t else None))
    return Split(name=(doc or {}).get("name", "My Split"), days=days)


@router.get("/split", response_model=Split)
async def get_split(user: dict = Depends(current_user)):
    return await load_split(user["id"], await _templates_by_id(user["id"]))


@router.put("/split", response_model=Split)
async def put_split(body: SplitIn, user: dict = Depends(current_user)):
    if sorted(d.weekday for d in body.days) != list(range(7)):
        raise HTTPException(status_code=422, detail="days must cover each weekday 0-6 exactly once")
    templates = await _templates_by_id(user["id"])
    for d in body.days:
        if d.template_id and d.template_id not in templates:
            raise HTTPException(status_code=422, detail=f"Unknown template {d.template_id}")
    days = [{"weekday": d.weekday, "template_id": d.template_id} for d in sorted(body.days, key=lambda x: x.weekday)]
    await db.splits.update_one(
        {"user_id": user["id"]}, {"$set": {"name": body.name, "days": days, "user_id": user["id"]}}, upsert=True
    )
    return await load_split(user["id"], templates)


@router.get("/today", response_model=TodayInfo)
async def get_today(user: dict = Depends(current_user)):
    today = today_iso()
    weekday = date.fromisoformat(today).weekday()
    templates = await _templates_by_id(user["id"])
    split = await load_split(user["id"], templates)
    tid = split.days[weekday].template_id
    active = await db.workouts.find_one({"user_id": user["id"], "status": "active"}, {"_id": 0, "id": 1})
    return TodayInfo(
        date=today,
        weekday=weekday,
        template=templates.get(tid) if tid else None,
        is_rest=tid is None,
        active_workout_id=active["id"] if active else None,
        split=split,
    )
