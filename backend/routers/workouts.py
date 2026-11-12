from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pymongo.errors import DuplicateKeyError

from lib.auth import current_user
from lib.dates import today_iso
from lib.db import db
from lib.training import (
    SLIM_PROJ,
    completed_set_count,
    detect_new_prs,
    duration_min,
    exercise_bests,
    summarize,
    workout_volume,
)
from models.common import utcnow
from models.workout import (
    FinishResult,
    Workout,
    WorkoutExercise,
    WorkoutSet,
    WorkoutStart,
    WorkoutSummary,
    WorkoutUpdate,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])

_SORT = [("date", -1), ("started_at", -1)]

# Projection for list endpoints — avoids deserialising full set payloads.
_LIST_PROJ = {
    "_id": 0,
    "id": 1,
    "name": 1,
    "date": 1,
    "status": 1,
    "template_id": 1,
    "started_at": 1,
    "finished_at": 1,
    "exercises.exercise_id": 1,
    "exercises.exercise_name": 1,
    "exercises.muscle_group": 1,
    "exercises.sets.completed": 1,
    "exercises.sets.set_type": 1,
    "exercises.sets.weight": 1,
    "exercises.sets.reps": 1,
}


async def _get_owned(id: str, user_id: str) -> Workout:
    doc = await db.workouts.find_one({"id": id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Workout not found")
    return Workout(**doc)


def _update_fields(body: WorkoutUpdate) -> dict:
    fields = {
        "name": body.name.strip() or "Workout",
        "notes": body.notes,
        "exercises": [e.model_dump() for e in body.exercises],
        "updated_at": utcnow(),
    }
    if body.date:
        fields["date"] = body.date
    # revision is managed by the caller, not _update_fields
    return fields


@router.get("", response_model=list[WorkoutSummary])
async def list_workouts(limit: int = Query(100, ge=1, le=500), user: dict = Depends(current_user)):
    docs = await db.workouts.find({"user_id": user["id"], "status": "completed"}, _LIST_PROJ).sort(_SORT).to_list(limit)
    return [summarize(Workout(**d)) for d in docs]


@router.get("/active", response_model=Workout | None)
async def get_active(user: dict = Depends(current_user)):
    doc = await db.workouts.find_one({"user_id": user["id"], "status": "active"}, {"_id": 0})
    return Workout(**doc) if doc else None


@router.get("/previous", response_model=dict[str, list[WorkoutSet]])
async def previous_sets(exercise_ids: str = "", exclude: str | None = None, user: dict = Depends(current_user)):
    """Sets from the most recent completed workout containing each exercise."""
    wanted = {e for e in exercise_ids.split(",") if e}
    out: dict[str, list[WorkoutSet]] = {}
    if not wanted:
        return out
    query: dict = {"user_id": user["id"], "status": "completed", "exercises.exercise_id": {"$in": list(wanted)}}
    if exclude:
        query["id"] = {"$ne": exclude}
    async for doc in db.workouts.find(query, SLIM_PROJ).sort(_SORT).limit(200):
        w = Workout(**doc)
        for ex in w.exercises:
            if ex.exercise_id in wanted and ex.exercise_id not in out:
                out[ex.exercise_id] = [s for s in ex.sets if s.completed]
        if len(out) == len(wanted):
            break
    return out


@router.post("", response_model=Workout, status_code=201)
async def start_workout(body: WorkoutStart, user: dict = Depends(current_user)):
    if await db.workouts.find_one({"user_id": user["id"], "status": "active"}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="You already have an active workout")
    exercises: list[WorkoutExercise] = []
    name = (body.name or "").strip() or "Quick Workout"
    if body.template_id:
        tdoc = await db.templates.find_one({"id": body.template_id, "user_id": user["id"]}, {"_id": 0})
        if not tdoc:
            raise HTTPException(status_code=404, detail="Template not found")
        name = (body.name or "").strip() or tdoc["name"]
        exercise_ids = [te["exercise_id"] for te in tdoc.get("exercises", [])]
        ex_docs = await db.exercises.find({"id": {"$in": exercise_ids}}, {"_id": 0, "id": 1, "equipment": 1}).to_list(500)
        equip_map = {d["id"]: d.get("equipment") for d in ex_docs}
        for te in tdoc.get("exercises", []):
            exercises.append(
                WorkoutExercise(
                    exercise_id=te["exercise_id"],
                    exercise_name=te["exercise_name"],
                    muscle_group=te["muscle_group"],
                    equipment=equip_map.get(te["exercise_id"]),
                    rest_seconds=te.get("rest_seconds", 120),
                    sets=[WorkoutSet() for _ in range(te.get("target_sets", 3))],
                )
            )
    w = Workout(name=name, date=today_iso(), template_id=body.template_id, exercises=exercises)
    try:
        await db.workouts.insert_one({**w.model_dump(), "user_id": user["id"]})
    except DuplicateKeyError as exc:
        # The partial unique index is the authoritative guard when two starts
        # pass the read check concurrently.
        raise HTTPException(status_code=409, detail="You already have an active workout") from exc
    return w


@router.get("/{id}", response_model=Workout)
async def get_workout(id: str, user: dict = Depends(current_user)):
    return await _get_owned(id, user["id"])


@router.put("/{id}", response_model=Workout)
async def update_workout(id: str, body: WorkoutUpdate, user: dict = Depends(current_user)):
    """
    Save an autosave edit only if the client holds the current revision.

    The conditional update is atomic, so a stale tab cannot overwrite a newer
    save or make its stale revision look current before finishing.
    """
    fields = _update_fields(body)
    fields["updated_at"] = utcnow()
    if body.revision is None:
        # Legacy clients are allowed one unconditional save, while current
        # clients always send a revision.
        result = await db.workouts.update_one(
            {"id": id, "user_id": user["id"]}, {"$set": fields},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Workout not found")
        doc = await db.workouts.find_one({"id": id, "user_id": user["id"]}, {"_id": 0})
        return Workout(**doc)

    expected_revision = body.revision
    revision_filter = (
        {"$or": [{"revision": 0}, {"revision": {"$exists": False}}]}
        if expected_revision == 0
        else {"revision": expected_revision}
    )
    fields["revision"] = expected_revision + 1
    result = await db.workouts.update_one(
        {"id": id, "user_id": user["id"], **revision_filter}, {"$set": fields},
    )
    if result.matched_count == 0:
        exists = await db.workouts.find_one({"id": id, "user_id": user["id"]}, {"_id": 1})
        if not exists:
            raise HTTPException(status_code=404, detail="Workout not found")
        raise HTTPException(
            status_code=409,
            detail="This workout was updated elsewhere. Reload to get the latest version.",
        )
    doc = await db.workouts.find_one({"id": id, "user_id": user["id"]}, {"_id": 0})
    return Workout(**doc)


@router.post("/{id}/finish", response_model=FinishResult)
async def finish_workout(id: str, body: WorkoutUpdate, user: dict = Depends(current_user)):
    """
    Finish a workout with the same atomic revision protection as PUT.

    If `revision` is supplied, the finish is applied only when the stored
    revision matches — preventing a stale client from finishing over a newer
    autosave that already ran on a different tab.

    The workout is never marked completed if the revision check fails; the
    document stays active so the user can continue from the latest state.
    """
    # Keep only completed sets; drop exercises left empty.
    cleaned: list[WorkoutExercise] = []
    for ex in body.exercises:
        sets = [s for s in ex.sets if s.completed]
        if sets:
            cleaned.append(ex.model_copy(update={"sets": sets}))
    body = body.model_copy(update={"exercises": cleaned})

    # Validate: reject finish if the workout has no meaningful working sets.
    # A working set is completed, non-warm-up, and has either positive reps or
    # positive duration_seconds (supports time-based exercises like Plank).
    total_working = sum(
        1
        for ex in cleaned
        for s in ex.sets
        if s.completed
        and s.set_type != "W"
        and ((s.reps and s.reps > 0) or (s.duration_seconds and s.duration_seconds > 0))
    )
    if total_working == 0:
        raise HTTPException(
            status_code=422,
            detail="Cannot finish a workout with no completed working sets. "
                   "Complete at least one set or discard the workout.",
        )

    # Verify ownership and that the workout is still active.
    current_doc = await db.workouts.find_one(
        {"id": id, "user_id": user["id"]},
        {"_id": 0, "status": 1, "revision": 1},
    )
    if not current_doc:
        raise HTTPException(status_code=404, detail="Workout not found")
    if current_doc["status"] != "active":
        raise HTTPException(status_code=409, detail="Workout is already finished")

    # Build update fields.
    fields = _update_fields(body)
    # Do not let the client change the date during finish.
    fields.pop("date", None)
    fields.update(status="completed", finished_at=utcnow(), updated_at=utcnow())

    if body.revision is not None:
        expected_rev = body.revision
        new_rev = expected_rev + 1
        fields["revision"] = new_rev

        revision_filter: dict
        if expected_rev == 0:
            revision_filter = {
                "$or": [
                    {"revision": 0},
                    {"revision": {"$exists": False}},
                ]
            }
        else:
            revision_filter = {"revision": expected_rev}

        result = await db.workouts.update_one(
            {"id": id, "user_id": user["id"], "status": "active", **revision_filter},
            {"$set": fields},
        )
        if result.matched_count == 0:
            # Could be: already finished (status no longer active) or revision mismatch.
            raise HTTPException(
                status_code=409,
                detail="This workout was updated elsewhere. Reload to see the latest version before finishing.",
            )
    else:
        # No revision supplied — backward-compatible unconditional finish.
        result = await db.workouts.update_one(
            {"id": id, "user_id": user["id"], "status": "active"},
            {"$set": fields},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=409, detail="Workout is already finished")

    done = await _get_owned(id, user["id"])

    # Load prior bests with slim projection (no loading_inputs).
    prior_docs = await db.workouts.find(
        {"user_id": user["id"], "status": "completed", "id": {"$ne": id}},
        SLIM_PROJ,
    ).to_list(5000)
    prior = exercise_bests([Workout(**d) for d in prior_docs])
    new_prs = detect_new_prs(prior, done)

    return FinishResult(
        workout=done,
        new_prs=new_prs,
        volume=workout_volume(done),
        completed_sets=completed_set_count(done),
        duration_min=duration_min(done) or 1,
    )


@router.delete("/{id}", status_code=204)
async def delete_workout(id: str, user: dict = Depends(current_user)):
    res = await db.workouts.delete_one({"id": id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workout not found")
    return Response(status_code=204)
