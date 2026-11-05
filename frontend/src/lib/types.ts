// Hand-written mirrors of the backend Pydantic models (backend/models/*). Keep in sync.

export type MuscleGroup =
  | "Chest" | "Back" | "Shoulders" | "Quads" | "Hamstrings" | "Glutes" | "Biceps" | "Triceps" | "Core" | "Calves";
export type Equipment = "Barbell" | "Dumbbell" | "Cable" | "Machine" | "Bodyweight" | "Kettlebell";

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Glutes", "Biceps", "Triceps", "Core", "Calves",
];
export const EQUIPMENT: Equipment[] = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Kettlebell"];

// models/auth.py
export interface LoginRequest { email: string; password: string }
export interface RegisterRequest extends LoginRequest { name: string; weight_kg: number; height_cm: number }
export interface ProfileUpdate { name: string; weight_kg: number; height_cm: number }
export interface User { id: string; email: string; name: string; weight_kg: number | null; height_cm: number | null }

// models/exercise.py
export interface ExerciseCreate { name: string; muscle_group: MuscleGroup; equipment: Equipment }
export interface Exercise extends ExerciseCreate { id: string; is_custom: boolean }

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
}

// models/workout.py
export type SetType = "W" | "N" | "D" | "F";
export type EffortMode = "rpe" | "rir";
export interface WorkoutSet {
  uid: string;
  set_type: SetType;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  completed: boolean;
}
export interface WorkoutExercise {
  uid: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
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
