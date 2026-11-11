from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.dates import today_iso
from lib.db import db
from models.history import SplitHistoryDay, SplitHistoryRecord
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

    # ── Save a split-history snapshot before overwriting ─────────────────────
    #
    # Historical split baseline (MEDIUM-5):
    # The first time a user saves a split, there is no existing config to
    # snapshot, so no historical record is created.  This means the user's
    # schedule history starts from their *first split change*, not from when
    # they first configured a split.  For existing users whose original split
    # creation date cannot be determined, we do not invent historical dates.
    #
    # Migration policy: if you need historical consistency for the pre-change
    # period, manually insert a split_history record with the user's original
    # split config and an estimated effective_from date (e.g. the date of their
    # first workout).  This is a one-time data backfill, not an automated
    # migration.
    existing = await db.splits.find_one({"user_id": user["id"]}, {"_id": 0})
    today = today_iso()

    if existing:
        # Only snapshot if the days config actually changed
        existing_days = sorted(existing.get("days", []), key=lambda x: x["weekday"])
        new_days = sorted([{"weekday": d.weekday, "template_id": d.template_id} for d in body.days], key=lambda x: x["weekday"])
        config_changed = existing_days != new_days

        if config_changed:
            # Close out any previously-open snapshot for this user
            await db.split_history.update_many(
                {"user_id": user["id"], "effective_to": None},
                {"$set": {"effective_to": today}},
            )

            # HIGH-2: Only create a new snapshot for today if one doesn't already
            # exist.  When A → B → C all happen on the same day, the first change
            # (A → B) archives config A as today's snapshot.  The second change
            # (B → C) must NOT overwrite that snapshot with B — the original
            # config A is the correct historical record for today.
            existing_snapshot = await db.split_history.find_one(
                {"user_id": user["id"], "effective_from": today},
                {"_id": 0, "days": 1},
            )
            if not existing_snapshot:
                # Resolve template names for the archived snapshot
                existing_split_days = []
                for ed in sorted(existing.get("days", []), key=lambda x: x["weekday"]):
                    tid = ed.get("template_id")
                    t = templates.get(tid) if tid else None
                    existing_split_days.append(
                        SplitHistoryDay(
                            weekday=ed["weekday"],
                            template_id=tid,
                            template_name=t.name if t else None,
                        )
                    )
                snapshot = SplitHistoryRecord(
                    effective_from=today,
                    effective_to=None,
                    split_name=existing.get("name", "My Split"),
                    days=existing_split_days,
                )
                await db.split_history.insert_one(
                    {**snapshot.model_dump(), "user_id": user["id"]}
                )

    # Save the new active split
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

    # Check if today's planned template was already completed today
    completed_today = False
    completed_workout_id = None
    if tid:
        finished = await db.workouts.find_one(
            {
                "user_id": user["id"],
                "status": "completed",
                "template_id": tid,
                "date": today,
            },
            {"_id": 0, "id": 1},
        )
        if finished:
            completed_today = True
            completed_workout_id = finished["id"]

    return TodayInfo(
        date=today,
        weekday=weekday,
        template=templates.get(tid) if tid else None,
        is_rest=tid is None,
        active_workout_id=active["id"] if active else None,
        split=split,
        completed_today=completed_today,
        completed_workout_id=completed_workout_id,
    )
