// Hand-written mirrors of the backend Pydantic models (backend/models/*). Keep in sync.

export type MuscleGroup =
  | "Chest" | "Back" | "Shoulders" | "Quads" | "Hamstrings" | "Glutes" | "Biceps" | "Triceps" | "Core" | "Calves";
export type Equipment =
  | "Barbell"
  | "Smith Machine"
  | "Dumbbell"
  | "Cable"
  | "Machine"
  | "Plate-Loaded Machine"
  | "Bodyweight"
  | "Kettlebell"
  | "Resistance Band";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Glutes", "Biceps", "Triceps", "Core", "Calves",
];
export const EQUIPMENT: Equipment[] = [
  "Barbell", "Smith Machine", "Dumbbell", "Cable", "Machine",
  "Plate-Loaded Machine", "Bodyweight", "Kettlebell", "Resistance Band",
];

// models/auth.py
export interface LoginRequest { email: string; password: string }
export interface RegisterRequest extends LoginRequest { name: string; weight_kg: number; height_cm: number }
export type Sex = "male" | "female";
export interface ProfileUpdate { name: string; weight_kg: number; height_cm: number; sex: Sex }
export interface User {
  id: string;
  email: string;
  name: string;
  weight_kg: number | null;
  height_cm: number | null;
  sex: Sex | null;
  /** Whether the user has completed the interactive onboarding tour */
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  onboarding_version: number;
}

// models/exercise.py
export interface ExerciseCreate {
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  exercise_type?: "Compound" | "Isolation" | null;
  primary_muscles?: string[];
  secondary_muscles?: string[];
}
export interface ExerciseUpdate {
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  exercise_type: "Compound" | "Isolation" | null;
  primary_muscles: string[];
  secondary_muscles: string[];
}
export interface Exercise extends ExerciseCreate {
  id: string;
  is_custom: boolean;
  exercise_type: "Compound" | "Isolation" | null;
  primary_muscles: string[];
  secondary_muscles: string[];
}

// models/template.py
export interface TemplateExercise {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  target_sets: number;
  target_reps: string;
  rest_seconds: number;
}
export interface TemplateIn { name: string; notes: string; exercises: TemplateExercise[] }
export interface Template extends TemplateIn { id: string; created_at: string }

// models/split.py
export interface SplitDay { weekday: number; template_id: string | null; template_name: string | null }
export interface Split { name: string; days: SplitDay[] }
export interface TodayInfo {
  date: string;
  weekday: number;
  template: Template | null;
  is_rest: boolean;
  active_workout_id: string | null;
  split: Split;
  /** True if today's planned template has already been completed today */
  completed_today: boolean;
  /** Workout ID of the session that completed today's split day (if completed_today is true) */
  completed_workout_id: string | null;
}

// models/workout.py
export type SetType = "W" | "N" | "D" | "F";
export type EffortMode = "rpe" | "rir";

/** Raw equipment-specific inputs stored alongside the canonical weight. */
export interface LoadingInputs {
  // Barbell / Smith Machine / Plate-Loaded Machine
  bar_weight?: number | null;       // kg — bar or machine starting resistance
  plates_per_side?: number | null;  // kg per side (plates only)
  total_plates?: number | null;     // kg total plates (alternative to per-side)
  bar_known?: boolean;              // false → bar resistance unknown (Smith / Plate-Loaded)
  // Dumbbell / Kettlebell
  per_dumbbell?: number | null;
  // Cable / Machine
  stack_weight?: number | null;
  // Bodyweight
  bodyweight?: number | null;
  added_weight?: number | null;
  assistance_weight?: number | null;
  bw_mode?: "normal" | "weighted" | "assisted";
  // Resistance Band
  band_resistance?: number | null;    // numeric if user entered one
  band_level?: string | null;         // text label if numeric not applicable
}

export interface WorkoutSet {
  uid: string;
  set_type: SetType;
  weight: number | null;       // canonical load for volume / e1RM
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  completed: boolean;
  loading_inputs?: LoadingInputs | null;
  weight_note?: string | null;
  /** Duration in seconds — for time-based exercises like Plank. Replaces reps+RPE/RIR. */
  duration_seconds?: number | null;
}
/** Exercise-level config — set once for the whole exercise, not per set.
 *  Stored on WorkoutExercise. Per-set loading_inputs only holds the variable part.
 */
export interface ExerciseConfig {
  // Barbell / Smith Machine / Plate-Loaded Machine
  bar_weight?: number | null;   // kg — the constant bar / starting resistance
  bar_known?: boolean;          // false → bar resistance unknown
  // Bodyweight
  bodyweight?: number | null;
  bw_mode?: "normal" | "weighted" | "assisted";
}

export interface WorkoutExercise {
  uid: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  equipment: Equipment | null;
  exercise_config?: ExerciseConfig | null;  // exercise-level config (bar weight, BW, etc.)
  notes: string;
  rest_seconds: number;
  effort_mode: EffortMode;
  sets: WorkoutSet[];
}
export interface WorkoutUpdate { name: string; notes: string; date: string | null; exercises: WorkoutExercise[] }
export interface WorkoutStart { template_id: string | null; name: string | null }
export interface Workout {
  id: string;
  name: string;
  date: string;
  status: "active" | "completed";
  template_id: string | null;
  notes: string;
  exercises: WorkoutExercise[];
  started_at: string;
  finished_at: string | null;
  updated_at: string;
}
export interface WorkoutSummary {
  id: string;
  name: string;
  date: string;
  status: "active" | "completed";
  started_at: string;
  finished_at: string | null;
  duration_min: number | null;
  volume: number;
  completed_sets: number;
  exercise_names: string[];
  muscle_groups: string[];
}
export interface PRRecord {
  exercise_id: string;
  exercise_name: string;
  kind: "weight" | "e1rm";
  value: number;
  weight: number;
  reps: number;
  weight_note: string;
}
export interface FinishResult {
  workout: Workout;
  new_prs: PRRecord[];
  volume: number;
  completed_sets: number;
  duration_min: number;
}
export type PreviousSets = Record<string, WorkoutSet[]>;

// models/analytics.py
export interface WeeklyVolume { week_start: string; volume: number; workouts: number }
export interface MuscleWorkload { muscle_group: string; sets: number; volume: number }
export interface PersonalRecord {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  best_weight: number;
  best_weight_reps: number;
  best_weight_date: string;
  best_e1rm: number;
  best_e1rm_date: string;
  equipment?: Equipment | null;
  weight_note?: string;
}
export interface AnalyticsSummary {
  total_workouts: number;
  this_week_volume: number;
  this_week_workouts: number;
  week_streak: number;
  weekly_volume: WeeklyVolume[];
  muscle_workload: MuscleWorkload[];
  prs: PersonalRecord[];
}
export interface ExerciseProgressPoint { date: string; top_weight: number; e1rm: number; volume: number; best_set: string }
export interface ExerciseProgress { exercise_id: string; exercise_name: string; points: ExerciseProgressPoint[] }

// models/analytics.py — sub-muscle breakdown
export interface SubMuscleWorkload { muscle: string; sets: number; volume: number }
export interface SubMuscleBreakdown { primary: SubMuscleWorkload[]; secondary: SubMuscleWorkload[] }

// models/history.py — consistency & calendar
export interface ConsistencyStats {
  total_sessions: number;
  total_workout_days: number;
  this_week_sessions: number;
  this_month_sessions: number;
  this_year_sessions: number;
  current_streak: number;
  longest_streak: number;
  weekly_consistency_pct: number;
  monthly_consistency_pct: number;
  all_time_consistency_pct: number;
  scheduled_days_total: number;
  completed_scheduled_days: number;
  missed_scheduled_days: number;
}

export interface CalendarWorkoutSummary {
  id: string;
  name: string;
  volume: number;
  completed_sets: number;
  duration_min: number | null;
}

export type CalendarDayStatus = "done" | "missed" | "rest" | "today" | "future" | "none";

export interface CalendarDay {
  date: string;
  status: CalendarDayStatus;
  is_scheduled: boolean;
  is_rest: boolean;
  scheduled_template_name: string | null;
  workouts: CalendarWorkoutSummary[];
}

export interface CalendarResponse {
  year: number;
  month: number;
  days: CalendarDay[];
}

export interface SplitHistoryDay {
  weekday: number;
  template_id: string | null;
  template_name: string | null;
}

export interface SplitHistoryRecord {
  effective_from: string;
  effective_to: string | null;
  split_name: string;
  days: SplitHistoryDay[];
}
