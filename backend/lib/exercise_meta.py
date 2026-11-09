"""
Exercise metadata: exercise_type, primary_muscles, secondary_muscles.

Keys are exact exercise names as stored in seed.py / the database.
This dict is used by seed.py to enrich existing exercise documents
and by the analytics router for sub-muscle breakdowns.

Rules followed:
- Compound = recruits 2+ major muscle groups across 2+ joints.
- Isolation = primarily targets one muscle group through one joint.
- primary_muscles: the muscle(s) doing the main work.
- secondary_muscles: muscles assisting significantly (not just stabilising).
  Compound exercises list meaningful helpers; isolation exercises rarely have any.
- Sub-muscle labels are consistent strings used by the frontend for grouping.
"""

# (exercise_type, primary_muscles, secondary_muscles)
EXERCISE_META: dict[str, tuple[str, list[str], list[str]]] = {

    # ── CHEST ────────────────────────────────────────────────────────────────
    "Barbell Bench Press": (
        "Compound",
        ["Middle Chest"],
        ["Triceps", "Front Deltoids"],
    ),
    "Incline Barbell Bench Press": (
        "Compound",
        ["Upper Chest"],
        ["Triceps", "Front Deltoids"],
    ),
    "Dumbbell Bench Press": (
        "Compound",
        ["Middle Chest"],
        ["Triceps", "Front Deltoids"],
    ),
    "Incline Dumbbell Press": (
        "Compound",
        ["Upper Chest"],
        ["Triceps", "Front Deltoids"],
    ),
    "Decline Bench Press": (
        "Compound",
        ["Lower Chest"],
        ["Triceps", "Front Deltoids"],
    ),
    "Dumbbell Fly": (
        "Isolation",
        ["Middle Chest"],
        ["Front Deltoids"],
    ),
    "Cable Crossover": (
        "Isolation",
        ["Lower Chest", "Middle Chest"],
        ["Front Deltoids"],
    ),
    "Pec Deck": (
        "Isolation",
        ["Middle Chest"],
        [],
    ),
    "Push-Up": (
        "Compound",
        ["Middle Chest"],
        ["Triceps", "Front Deltoids"],
    ),
    "Chest Dip": (
        "Compound",
        ["Lower Chest"],
        ["Triceps", "Front Deltoids"],
    ),
    "Machine Chest Press": (
        "Compound",
        ["Middle Chest"],
        ["Triceps", "Front Deltoids"],
    ),

    # ── BACK ─────────────────────────────────────────────────────────────────
    "Deadlift": (
        "Compound",
        ["Lower Back", "Lats"],
        ["Glutes", "Hamstrings", "Upper Back", "Traps"],
    ),
    "Barbell Row": (
        "Compound",
        ["Lats", "Mid Back"],
        ["Biceps", "Rear Deltoids", "Lower Back"],
    ),
    "Pendlay Row": (
        "Compound",
        ["Lats", "Mid Back"],
        ["Biceps", "Rear Deltoids", "Lower Back"],
    ),
    "Pull-Up": (
        "Compound",
        ["Lats"],
        ["Biceps", "Rear Deltoids", "Mid Back"],
    ),
    "Chin-Up": (
        "Compound",
        ["Lats", "Biceps"],
        ["Mid Back", "Rear Deltoids"],
    ),
    "Lat Pulldown": (
        "Compound",
        ["Lats"],
        ["Biceps", "Rear Deltoids"],
    ),
    "Seated Cable Row": (
        "Compound",
        ["Mid Back", "Lats"],
        ["Biceps", "Rear Deltoids"],
    ),
    "One-Arm Dumbbell Row": (
        "Compound",
        ["Lats", "Mid Back"],
        ["Biceps", "Rear Deltoids"],
    ),
    "T-Bar Row": (
        "Compound",
        ["Mid Back", "Lats"],
        ["Biceps", "Rear Deltoids"],
    ),
    "Chest-Supported Row": (
        "Compound",
        ["Mid Back", "Lats"],
        ["Biceps", "Rear Deltoids"],
    ),
    "Straight-Arm Pulldown": (
        "Isolation",
        ["Lats"],
        ["Triceps Long Head"],
    ),
    "Rack Pull": (
        "Compound",
        ["Upper Back", "Traps"],
        ["Lower Back", "Glutes", "Hamstrings"],
    ),

    # ── SHOULDERS ────────────────────────────────────────────────────────────
    "Overhead Press": (
        "Compound",
        ["Front Deltoids", "Side Deltoids"],
        ["Triceps", "Upper Chest"],
    ),
    "Seated Dumbbell Press": (
        "Compound",
        ["Front Deltoids", "Side Deltoids"],
        ["Triceps"],
    ),
    "Arnold Press": (
        "Compound",
        ["Front Deltoids", "Side Deltoids"],
        ["Triceps", "Rear Deltoids"],
    ),
    "Lateral Raise": (
        "Isolation",
        ["Side Deltoids"],
        [],
    ),
    "Cable Lateral Raise": (
        "Isolation",
        ["Side Deltoids"],
        [],
    ),
    "Rear Delt Fly": (
        "Isolation",
        ["Rear Deltoids"],
        ["Mid Back"],
    ),
    "Face Pull": (
        "Isolation",
        ["Rear Deltoids"],
        ["Upper Back", "External Rotators"],
    ),
    "Upright Row": (
        "Compound",
        ["Side Deltoids", "Traps"],
        ["Biceps", "Front Deltoids"],
    ),
    "Machine Shoulder Press": (
        "Compound",
        ["Front Deltoids", "Side Deltoids"],
        ["Triceps"],
    ),

    # ── QUADS ─────────────────────────────────────────────────────────────────
    "Back Squat": (
        "Compound",
        ["Quadriceps"],
        ["Glutes", "Hamstrings", "Lower Back"],
    ),
    "Front Squat": (
        "Compound",
        ["Quadriceps"],
        ["Glutes", "Upper Back"],
    ),
    "Leg Press": (
        "Compound",
        ["Quadriceps"],
        ["Glutes", "Hamstrings"],
    ),
    "Hack Squat": (
        "Compound",
        ["Quadriceps"],
        ["Glutes"],
    ),
    "Bulgarian Split Squat": (
        "Compound",
        ["Quadriceps", "Glutes"],
        ["Hamstrings", "Calves"],
    ),
    "Leg Extension": (
        "Isolation",
        ["Quadriceps"],
        [],
    ),
    "Walking Lunge": (
        "Compound",
        ["Quadriceps", "Glutes"],
        ["Hamstrings", "Calves"],
    ),
    "Goblet Squat": (
        "Compound",
        ["Quadriceps"],
        ["Glutes", "Core"],
    ),

    # ── HAMSTRINGS ────────────────────────────────────────────────────────────
    "Romanian Deadlift": (
        "Compound",
        ["Hamstrings"],
        ["Glutes", "Lower Back"],
    ),
    "Lying Leg Curl": (
        "Isolation",
        ["Hamstrings"],
        [],
    ),
    "Seated Leg Curl": (
        "Isolation",
        ["Hamstrings"],
        [],
    ),
    "Good Morning": (
        "Compound",
        ["Hamstrings", "Lower Back"],
        ["Glutes"],
    ),
    "Nordic Curl": (
        "Isolation",
        ["Hamstrings"],
        ["Glutes"],
    ),
    "Stiff-Leg Dumbbell Deadlift": (
        "Compound",
        ["Hamstrings"],
        ["Glutes", "Lower Back"],
    ),

    # ── GLUTES ────────────────────────────────────────────────────────────────
    "Hip Thrust": (
        "Compound",
        ["Glutes"],
        ["Hamstrings"],
    ),
    "Glute Bridge": (
        "Compound",
        ["Glutes"],
        ["Hamstrings"],
    ),
    "Cable Kickback": (
        "Isolation",
        ["Glutes"],
        [],
    ),
    "Kettlebell Swing": (
        "Compound",
        ["Glutes", "Hamstrings"],
        ["Lower Back", "Core"],
    ),

    # ── BICEPS ────────────────────────────────────────────────────────────────
    "Barbell Curl": (
        "Isolation",
        ["Biceps"],
        ["Brachialis"],
    ),
    "Dumbbell Curl": (
        "Isolation",
        ["Biceps"],
        ["Brachialis"],
    ),
    "Hammer Curl": (
        "Isolation",
        ["Brachialis", "Biceps"],
        ["Brachioradialis"],
    ),
    "Incline Dumbbell Curl": (
        "Isolation",
        ["Biceps Long Head"],
        ["Brachialis"],
    ),
    "Preacher Curl": (
        "Isolation",
        ["Biceps Short Head"],
        ["Brachialis"],
    ),
    "Cable Curl": (
        "Isolation",
        ["Biceps"],
        ["Brachialis"],
    ),

    # ── TRICEPS ───────────────────────────────────────────────────────────────
    "Close-Grip Bench Press": (
        "Compound",
        ["Triceps"],
        ["Middle Chest", "Front Deltoids"],
    ),
    "Tricep Pushdown": (
        "Isolation",
        ["Triceps Lateral Head"],
        ["Triceps Medial Head"],
    ),
    "Overhead Tricep Extension": (
        "Isolation",
        ["Triceps Long Head"],
        ["Triceps Lateral Head"],
    ),
    "Skull Crusher": (
        "Isolation",
        ["Triceps Long Head", "Triceps Lateral Head"],
        ["Triceps Medial Head"],
    ),
    "Bench Dip": (
        "Compound",
        ["Triceps"],
        ["Front Deltoids", "Middle Chest"],
    ),

    # ── CORE ──────────────────────────────────────────────────────────────────
    "Plank": (
        "Isolation",
        ["Rectus Abdominis", "Transverse Abdominis"],
        ["Obliques", "Lower Back"],
    ),
    "Hanging Leg Raise": (
        "Isolation",
        ["Rectus Abdominis", "Hip Flexors"],
        ["Obliques"],
    ),
    "Cable Crunch": (
        "Isolation",
        ["Rectus Abdominis"],
        ["Obliques"],
    ),
    "Ab Wheel Rollout": (
        "Compound",
        ["Rectus Abdominis", "Transverse Abdominis"],
        ["Lats", "Triceps Long Head"],
    ),
    "Russian Twist": (
        "Isolation",
        ["Obliques"],
        ["Rectus Abdominis"],
    ),

    # ── CALVES ────────────────────────────────────────────────────────────────
    "Standing Calf Raise": (
        "Isolation",
        ["Gastrocnemius"],
        ["Soleus"],
    ),
    "Seated Calf Raise": (
        "Isolation",
        ["Soleus"],
        ["Gastrocnemius"],
    ),
}
