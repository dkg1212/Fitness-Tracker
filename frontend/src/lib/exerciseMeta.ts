/**
 * Client-side mirror of backend/lib/exercise_meta.py
 * Used by the Analytics page for sub-muscle breakdown.
 * Keyed by exercise name (exact match).
 */
export interface ExerciseMeta {
  exerciseType: "Compound" | "Isolation";
  primaryMuscles: string[];
  secondaryMuscles: string[];
  /**
   * Time-based exercises (Plank, Dead Hang, etc.) are measured in seconds
   * rather than reps. The logger shows a duration field + countdown timer
   * instead of reps + RPE/RIR.
   */
  isTimeBased?: boolean;
}

/** Set of exercise names that are measured in time, not reps. */
export const TIME_BASED_EXERCISES = new Set([
  "Plank",
  "Side Plank",
  "Dead Hang",
  "Wall Sit",
  "L-Sit",
  "Hollow Body Hold",
  "Superman Hold",
  "Glute Bridge", // can be timed
]);

export const EXERCISE_META: Record<string, ExerciseMeta> = {
  // CHEST
  "Barbell Bench Press": { exerciseType: "Compound", primaryMuscles: ["Middle Chest"], secondaryMuscles: ["Triceps", "Front Deltoids"] },
  "Incline Barbell Bench Press": { exerciseType: "Compound", primaryMuscles: ["Upper Chest"], secondaryMuscles: ["Triceps", "Front Deltoids"] },
  "Dumbbell Bench Press": { exerciseType: "Compound", primaryMuscles: ["Middle Chest"], secondaryMuscles: ["Triceps", "Front Deltoids"] },
  "Incline Dumbbell Press": { exerciseType: "Compound", primaryMuscles: ["Upper Chest"], secondaryMuscles: ["Triceps", "Front Deltoids"] },
  "Decline Bench Press": { exerciseType: "Compound", primaryMuscles: ["Lower Chest"], secondaryMuscles: ["Triceps", "Front Deltoids"] },
  "Dumbbell Fly": { exerciseType: "Isolation", primaryMuscles: ["Middle Chest"], secondaryMuscles: ["Front Deltoids"] },
  "Cable Crossover": { exerciseType: "Isolation", primaryMuscles: ["Lower Chest", "Middle Chest"], secondaryMuscles: ["Front Deltoids"] },
  "Pec Deck": { exerciseType: "Isolation", primaryMuscles: ["Middle Chest"], secondaryMuscles: [] },
  "Push-Up": { exerciseType: "Compound", primaryMuscles: ["Middle Chest"], secondaryMuscles: ["Triceps", "Front Deltoids"] },
  "Chest Dip": { exerciseType: "Compound", primaryMuscles: ["Lower Chest"], secondaryMuscles: ["Triceps", "Front Deltoids"] },
  "Machine Chest Press": { exerciseType: "Compound", primaryMuscles: ["Middle Chest"], secondaryMuscles: ["Triceps", "Front Deltoids"] },
  // BACK
  "Deadlift": { exerciseType: "Compound", primaryMuscles: ["Lower Back", "Lats"], secondaryMuscles: ["Glutes", "Hamstrings", "Upper Back", "Traps"] },
  "Barbell Row": { exerciseType: "Compound", primaryMuscles: ["Lats", "Mid Back"], secondaryMuscles: ["Biceps", "Rear Deltoids", "Lower Back"] },
  "Pendlay Row": { exerciseType: "Compound", primaryMuscles: ["Lats", "Mid Back"], secondaryMuscles: ["Biceps", "Rear Deltoids", "Lower Back"] },
  "Pull-Up": { exerciseType: "Compound", primaryMuscles: ["Lats"], secondaryMuscles: ["Biceps", "Rear Deltoids", "Mid Back"] },
  "Chin-Up": { exerciseType: "Compound", primaryMuscles: ["Lats", "Biceps"], secondaryMuscles: ["Mid Back", "Rear Deltoids"] },
  "Lat Pulldown": { exerciseType: "Compound", primaryMuscles: ["Lats"], secondaryMuscles: ["Biceps", "Rear Deltoids"] },
  "Seated Cable Row": { exerciseType: "Compound", primaryMuscles: ["Mid Back", "Lats"], secondaryMuscles: ["Biceps", "Rear Deltoids"] },
  "One-Arm Dumbbell Row": { exerciseType: "Compound", primaryMuscles: ["Lats", "Mid Back"], secondaryMuscles: ["Biceps", "Rear Deltoids"] },
  "T-Bar Row": { exerciseType: "Compound", primaryMuscles: ["Mid Back", "Lats"], secondaryMuscles: ["Biceps", "Rear Deltoids"] },
  "Chest-Supported Row": { exerciseType: "Compound", primaryMuscles: ["Mid Back", "Lats"], secondaryMuscles: ["Biceps", "Rear Deltoids"] },
  "Straight-Arm Pulldown": { exerciseType: "Isolation", primaryMuscles: ["Lats"], secondaryMuscles: ["Triceps Long Head"] },
  "Rack Pull": { exerciseType: "Compound", primaryMuscles: ["Upper Back", "Traps"], secondaryMuscles: ["Lower Back", "Glutes", "Hamstrings"] },
  // SHOULDERS
  "Overhead Press": { exerciseType: "Compound", primaryMuscles: ["Front Deltoids", "Side Deltoids"], secondaryMuscles: ["Triceps", "Upper Chest"] },
  "Seated Dumbbell Press": { exerciseType: "Compound", primaryMuscles: ["Front Deltoids", "Side Deltoids"], secondaryMuscles: ["Triceps"] },
  "Arnold Press": { exerciseType: "Compound", primaryMuscles: ["Front Deltoids", "Side Deltoids"], secondaryMuscles: ["Triceps", "Rear Deltoids"] },
  "Lateral Raise": { exerciseType: "Isolation", primaryMuscles: ["Side Deltoids"], secondaryMuscles: [] },
  "Cable Lateral Raise": { exerciseType: "Isolation", primaryMuscles: ["Side Deltoids"], secondaryMuscles: [] },
  "Rear Delt Fly": { exerciseType: "Isolation", primaryMuscles: ["Rear Deltoids"], secondaryMuscles: ["Mid Back"] },
  "Face Pull": { exerciseType: "Isolation", primaryMuscles: ["Rear Deltoids"], secondaryMuscles: ["Upper Back", "External Rotators"] },
  "Upright Row": { exerciseType: "Compound", primaryMuscles: ["Side Deltoids", "Traps"], secondaryMuscles: ["Biceps", "Front Deltoids"] },
  "Machine Shoulder Press": { exerciseType: "Compound", primaryMuscles: ["Front Deltoids", "Side Deltoids"], secondaryMuscles: ["Triceps"] },
  // QUADS
  "Back Squat": { exerciseType: "Compound", primaryMuscles: ["Quadriceps"], secondaryMuscles: ["Glutes", "Hamstrings", "Lower Back"] },
  "Front Squat": { exerciseType: "Compound", primaryMuscles: ["Quadriceps"], secondaryMuscles: ["Glutes", "Upper Back"] },
  "Leg Press": { exerciseType: "Compound", primaryMuscles: ["Quadriceps"], secondaryMuscles: ["Glutes", "Hamstrings"] },
  "Hack Squat": { exerciseType: "Compound", primaryMuscles: ["Quadriceps"], secondaryMuscles: ["Glutes"] },
  "Bulgarian Split Squat": { exerciseType: "Compound", primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Hamstrings", "Calves"] },
  "Leg Extension": { exerciseType: "Isolation", primaryMuscles: ["Quadriceps"], secondaryMuscles: [] },
  "Walking Lunge": { exerciseType: "Compound", primaryMuscles: ["Quadriceps", "Glutes"], secondaryMuscles: ["Hamstrings", "Calves"] },
  "Goblet Squat": { exerciseType: "Compound", primaryMuscles: ["Quadriceps"], secondaryMuscles: ["Glutes", "Core"] },
  // HAMSTRINGS
  "Romanian Deadlift": { exerciseType: "Compound", primaryMuscles: ["Hamstrings"], secondaryMuscles: ["Glutes", "Lower Back"] },
  "Lying Leg Curl": { exerciseType: "Isolation", primaryMuscles: ["Hamstrings"], secondaryMuscles: [] },
  "Seated Leg Curl": { exerciseType: "Isolation", primaryMuscles: ["Hamstrings"], secondaryMuscles: [] },
  "Good Morning": { exerciseType: "Compound", primaryMuscles: ["Hamstrings", "Lower Back"], secondaryMuscles: ["Glutes"] },
  "Nordic Curl": { exerciseType: "Isolation", primaryMuscles: ["Hamstrings"], secondaryMuscles: ["Glutes"] },
  "Stiff-Leg Dumbbell Deadlift": { exerciseType: "Compound", primaryMuscles: ["Hamstrings"], secondaryMuscles: ["Glutes", "Lower Back"] },
  // GLUTES
  "Hip Thrust": { exerciseType: "Compound", primaryMuscles: ["Glutes"], secondaryMuscles: ["Hamstrings"] },
  "Glute Bridge": { exerciseType: "Compound", primaryMuscles: ["Glutes"], secondaryMuscles: ["Hamstrings"] },
  "Cable Kickback": { exerciseType: "Isolation", primaryMuscles: ["Glutes"], secondaryMuscles: [] },
  "Kettlebell Swing": { exerciseType: "Compound", primaryMuscles: ["Glutes", "Hamstrings"], secondaryMuscles: ["Lower Back", "Core"] },
  // BICEPS
  "Barbell Curl": { exerciseType: "Isolation", primaryMuscles: ["Biceps"], secondaryMuscles: ["Brachialis"] },
  "Dumbbell Curl": { exerciseType: "Isolation", primaryMuscles: ["Biceps"], secondaryMuscles: ["Brachialis"] },
  "Hammer Curl": { exerciseType: "Isolation", primaryMuscles: ["Brachialis", "Biceps"], secondaryMuscles: ["Brachioradialis"] },
  "Incline Dumbbell Curl": { exerciseType: "Isolation", primaryMuscles: ["Biceps Long Head"], secondaryMuscles: ["Brachialis"] },
  "Preacher Curl": { exerciseType: "Isolation", primaryMuscles: ["Biceps Short Head"], secondaryMuscles: ["Brachialis"] },
  "Cable Curl": { exerciseType: "Isolation", primaryMuscles: ["Biceps"], secondaryMuscles: ["Brachialis"] },
  // TRICEPS
  "Close-Grip Bench Press": { exerciseType: "Compound", primaryMuscles: ["Triceps"], secondaryMuscles: ["Middle Chest", "Front Deltoids"] },
  "Tricep Pushdown": { exerciseType: "Isolation", primaryMuscles: ["Triceps Lateral Head"], secondaryMuscles: ["Triceps Medial Head"] },
  "Overhead Tricep Extension": { exerciseType: "Isolation", primaryMuscles: ["Triceps Long Head"], secondaryMuscles: ["Triceps Lateral Head"] },
  "Skull Crusher": { exerciseType: "Isolation", primaryMuscles: ["Triceps Long Head", "Triceps Lateral Head"], secondaryMuscles: ["Triceps Medial Head"] },
  "Bench Dip": { exerciseType: "Compound", primaryMuscles: ["Triceps"], secondaryMuscles: ["Front Deltoids", "Middle Chest"] },
  // CORE
  "Plank": { exerciseType: "Isolation", primaryMuscles: ["Rectus Abdominis", "Transverse Abdominis"], secondaryMuscles: ["Obliques", "Lower Back"], isTimeBased: true },
  "Hanging Leg Raise": { exerciseType: "Isolation", primaryMuscles: ["Rectus Abdominis", "Hip Flexors"], secondaryMuscles: ["Obliques"] },
  "Cable Crunch": { exerciseType: "Isolation", primaryMuscles: ["Rectus Abdominis"], secondaryMuscles: ["Obliques"] },
  "Ab Wheel Rollout": { exerciseType: "Compound", primaryMuscles: ["Rectus Abdominis", "Transverse Abdominis"], secondaryMuscles: ["Lats", "Triceps Long Head"] },
  "Russian Twist": { exerciseType: "Isolation", primaryMuscles: ["Obliques"], secondaryMuscles: ["Rectus Abdominis"] },
  // CALVES
  "Standing Calf Raise": { exerciseType: "Isolation", primaryMuscles: ["Gastrocnemius"], secondaryMuscles: ["Soleus"] },
  "Seated Calf Raise": { exerciseType: "Isolation", primaryMuscles: ["Soleus"], secondaryMuscles: ["Gastrocnemius"] },
};
