"""Idempotent seed: demo user, exercise library, templates, weekly split, 4 weeks of history.

Run: cd /app/backend && python seed.py
"""

import asyncio
import random
import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
import os

from lib.dates import today_iso
from lib.db import db, ensure_indexes
from lib.exercise_meta import EXERCISE_META
from models.template import Template, TemplateExercise
from models.workout import Workout, WorkoutExercise, WorkoutSet

DEMO_EMAIL = "athlete@ironcore.app"
DEMO_PASSWORD = "IronCore#2026"
DEMO_NAME = "Athlete"

EXERCISES: list[tuple[str, str, str]] = [
    # Chest
    ("Barbell Bench Press", "Chest", "Barbell"), ("Incline Barbell Bench Press", "Chest", "Barbell"),
    ("Dumbbell Bench Press", "Chest", "Dumbbell"), ("Incline Dumbbell Press", "Chest", "Dumbbell"),
    ("Decline Bench Press", "Chest", "Barbell"), ("Dumbbell Fly", "Chest", "Dumbbell"),
    ("Cable Crossover", "Chest", "Cable"), ("Pec Deck", "Chest", "Machine"),
    ("Push-Up", "Chest", "Bodyweight"), ("Chest Dip", "Chest", "Bodyweight"),
    ("Machine Chest Press", "Chest", "Machine"),
    # Back
    ("Deadlift", "Back", "Barbell"), ("Barbell Row", "Back", "Barbell"), ("Pendlay Row", "Back", "Barbell"),
    ("Pull-Up", "Back", "Bodyweight"), ("Chin-Up", "Back", "Bodyweight"), ("Lat Pulldown", "Back", "Cable"),
    ("Seated Cable Row", "Back", "Cable"), ("One-Arm Dumbbell Row", "Back", "Dumbbell"),
    ("T-Bar Row", "Back", "Machine"), ("Chest-Supported Row", "Back", "Machine"),
    ("Straight-Arm Pulldown", "Back", "Cable"), ("Rack Pull", "Back", "Barbell"),
    # Shoulders
    ("Overhead Press", "Shoulders", "Barbell"), ("Seated Dumbbell Press", "Shoulders", "Dumbbell"),
    ("Arnold Press", "Shoulders", "Dumbbell"), ("Lateral Raise", "Shoulders", "Dumbbell"),
    ("Cable Lateral Raise", "Shoulders", "Cable"), ("Rear Delt Fly", "Shoulders", "Dumbbell"),
    ("Face Pull", "Shoulders", "Cable"), ("Upright Row", "Shoulders", "Barbell"),
    ("Machine Shoulder Press", "Shoulders", "Machine"),
    # Quads
    ("Back Squat", "Quads", "Barbell"), ("Front Squat", "Quads", "Barbell"), ("Leg Press", "Quads", "Machine"),
    ("Hack Squat", "Quads", "Machine"), ("Bulgarian Split Squat", "Quads", "Dumbbell"),
    ("Leg Extension", "Quads", "Machine"), ("Walking Lunge", "Quads", "Dumbbell"),
    ("Goblet Squat", "Quads", "Kettlebell"),
    # Hamstrings
    ("Romanian Deadlift", "Hamstrings", "Barbell"), ("Lying Leg Curl", "Hamstrings", "Machine"),
    ("Seated Leg Curl", "Hamstrings", "Machine"), ("Good Morning", "Hamstrings", "Barbell"),
    ("Nordic Curl", "Hamstrings", "Bodyweight"), ("Stiff-Leg Dumbbell Deadlift", "Hamstrings", "Dumbbell"),
    # Glutes
    ("Hip Thrust", "Glutes", "Barbell"), ("Glute Bridge", "Glutes", "Bodyweight"),
    ("Cable Kickback", "Glutes", "Cable"), ("Kettlebell Swing", "Glutes", "Kettlebell"),
    # Biceps
    ("Barbell Curl", "Biceps", "Barbell"), ("Dumbbell Curl", "Biceps", "Dumbbell"),
    ("Hammer Curl", "Biceps", "Dumbbell"), ("Incline Dumbbell Curl", "Biceps", "Dumbbell"),
    ("Preacher Curl", "Biceps", "Machine"), ("Cable Curl", "Biceps", "Cable"),
    # Triceps
    ("Close-Grip Bench Press", "Triceps", "Barbell"), ("Tricep Pushdown", "Triceps", "Cable"),
    ("Overhead Tricep Extension", "Triceps", "Cable"), ("Skull Crusher", "Triceps", "Barbell"),
    ("Bench Dip", "Triceps", "Bodyweight"),
    # Core
    ("Plank", "Core", "Bodyweight"), ("Hanging Leg Raise", "Core", "Bodyweight"),
    ("Cable Crunch", "Core", "Cable"), ("Ab Wheel Rollout", "Core", "Bodyweight"),
    ("Russian Twist", "Core", "Bodyweight"),
    # Calves
    ("Standing Calf Raise", "Calves", "Machine"), ("Seated Calf Raise", "Calves", "Machine"),
]

# name -> (sets, reps range, rest seconds)
TEMPLATES: dict[str, list[tuple[str, int, str, int]]] = {
    "Push": [("Barbell Bench Press", 3, "5-8", 180), ("Incline Dumbbell Press", 3, "8-10", 120),
             ("Overhead Press", 3, "6-8", 150), ("Lateral Raise", 3, "12-15", 60),
             ("Tricep Pushdown", 3, "10-12", 60)],
    "Pull": [("Deadlift", 3, "5", 180), ("Pull-Up", 3, "6-10", 120), ("Barbell Row", 3, "8", 120),
             ("Face Pull", 3, "15", 60), ("Barbell Curl", 3, "10", 60)],
    "Legs": [("Back Squat", 3, "5-8", 180), ("Romanian Deadlift", 3, "8", 150), ("Leg Press", 3, "10-12", 120),
             ("Lying Leg Curl", 3, "12", 60), ("Standing Calf Raise", 4, "12", 60)],
    "Upper": [("Dumbbell Bench Press", 3, "8-10", 120), ("Lat Pulldown", 3, "10", 90),
              ("Seated Dumbbell Press", 3, "10", 90), ("Seated Cable Row", 3, "10", 90),
              ("Hammer Curl", 2, "12", 60), ("Overhead Tricep Extension", 2, "12", 60)],
    "Lower": [("Front Squat", 3, "6", 180), ("Hip Thrust", 3, "8-10", 120), ("Bulgarian Split Squat", 3, "10", 90),
              ("Seated Leg Curl", 3, "12", 60), ("Hanging Leg Raise", 3, "12", 60)],
    "Full Body": [("Back Squat", 3, "5", 180), ("Barbell Bench Press", 3, "5", 180), ("Barbell Row", 3, "8", 120),
                  ("Cable Crunch", 3, "15", 60)],
}

SPLIT = {0: "Push", 1: "Pull", 2: "Legs", 3: None, 4: "Upper", 5: "Lower", 6: None}

BASE_KG = {
    "Barbell Bench Press": 70, "Incline Dumbbell Press": 26, "Overhead Press": 42.5, "Lateral Raise": 10,
    "Tricep Pushdown": 30, "Deadlift": 130, "Pull-Up": 0, "Barbell Row": 60, "Face Pull": 20, "Barbell Curl": 30,
    "Back Squat": 100, "Romanian Deadlift": 80, "Leg Press": 160, "Lying Leg Curl": 40, "Standing Calf Raise": 60,
    "Dumbbell Bench Press": 30, "Lat Pulldown": 55, "Seated Dumbbell Press": 22, "Seated Cable Row": 55,
    "Hammer Curl": 14, "Overhead Tricep Extension": 25, "Front Squat": 70, "Hip Thrust": 100,
    "Bulgarian Split Squat": 16, "Seated Leg Curl": 40, "Hanging Leg Raise": 0, "Cable Crunch": 40,
}


def ex_id(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"ironcore.exercise.{name.lower()}"))


async def seed() -> None:
    await ensure_indexes()

    # user
    user = await db.users.find_one({"email": DEMO_EMAIL})
    user_id = user["id"] if user else str(uuid.uuid4())
    await db.users.update_one(
        {"email": DEMO_EMAIL},
        # The demo profile is data-only. Authentication is now handled by Clerk.
        {"$set": {"id": user_id, "email": DEMO_EMAIL, "name": DEMO_NAME}},
        upsert=True,
    )

    # built-in exercise library (stable ids)
    meta = {}
    for name, mg, eq in EXERCISES:
        meta[name] = (ex_id(name), mg)
        ex_type, primary, secondary = EXERCISE_META.get(name, (None, [], []))
        await db.exercises.update_one(
            {"id": ex_id(name)},
            {"$set": {
                "id": ex_id(name),
                "name": name,
                "muscle_group": mg,
                "equipment": eq,
                "is_custom": False,
                "exercise_type": ex_type,
                "primary_muscles": primary,
                "secondary_muscles": secondary,
            }},
            upsert=True,
        )

    # templates
    tmpl_ids: dict[str, str] = {}
    if await db.templates.count_documents({"user_id": user_id}) == 0:
        for i, (tname, items) in enumerate(TEMPLATES.items()):
            t = Template(
                name=tname,
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(minutes=i),
                exercises=[
                    TemplateExercise(exercise_id=meta[n][0], exercise_name=n, muscle_group=meta[n][1],
                                     target_sets=s, target_reps=r, rest_seconds=rest)
                    for n, s, r, rest in items
                ],
            )
            await db.templates.insert_one({**t.model_dump(), "user_id": user_id})
    for d in await db.templates.find({"user_id": user_id}).to_list(500):
        tmpl_ids[d["name"]] = d["id"]

    # split
    if not await db.splits.find_one({"user_id": user_id}):
        days = [{"weekday": wd, "template_id": tmpl_ids.get(t) if t else None} for wd, t in SPLIT.items()]
        await db.splits.insert_one({"user_id": user_id, "name": "PPL + Upper/Lower", "days": days})

    # 4 weeks of history (only once)
    if await db.workouts.count_documents({"user_id": user_id}) == 0:
        rng = random.Random(42)
        tz = ZoneInfo(os.environ.get("APP_TZ", "UTC"))
        today = date.fromisoformat(today_iso())
        for days_ago in range(28, 0, -1):
            d = today - timedelta(days=days_ago)
            tname = SPLIT[d.weekday()]
            if not tname or rng.random() < 0.08:
                continue
            week_idx = (28 - days_ago) // 7
            start = datetime.combine(d, time(18, rng.randint(0, 40)), tzinfo=tz).astimezone(timezone.utc)
            exercises = []
            for i, (n, nsets, reps, rest) in enumerate(TEMPLATES[tname]):
                base = BASE_KG.get(n, 20)
                step = 2.5 if base >= 30 else (1 if base > 0 else 0)
                weight = base + step * week_idx
                low = int(reps.split("-")[0])
                sets = []
                if i == 0 and weight >= 40:
                    sets.append(WorkoutSet(set_type="W", weight=round(weight * 0.5 / 2.5) * 2.5, reps=8, completed=True))
                for k in range(nsets):
                    r = max(1, low + rng.randint(0, 2) - (1 if k == nsets - 1 else 0))
                    rpe = rng.choice([7, 7.5, 8, 8.5, 9]) + (0.5 if k == nsets - 1 else 0)
                    rpe = min(rpe, 10)
                    sets.append(WorkoutSet(weight=float(weight), reps=r, rpe=rpe, rir=round(10 - rpe, 1), completed=True))
                exercises.append(WorkoutExercise(exercise_id=meta[n][0], exercise_name=n, muscle_group=meta[n][1],
                                                 rest_seconds=rest, sets=sets))
            w = Workout(
                name=tname,
                date=d.isoformat(),
                status="completed",
                template_id=tmpl_ids.get(tname),
                exercises=exercises,
                started_at=start,
                finished_at=start + timedelta(minutes=rng.randint(52, 78)),
                updated_at=start + timedelta(minutes=80),
            )
            await db.workouts.insert_one({**w.model_dump(), "user_id": user_id})

    counts = {c: await db[c].count_documents({}) for c in ("users", "exercises", "templates", "workouts")}
    print("seeded", counts)


if __name__ == "__main__":
    asyncio.run(seed())
