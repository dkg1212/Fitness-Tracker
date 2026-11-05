import { format, parseISO } from "date-fns";
import type { Exercise, Workout, WorkoutExercise, WorkoutSet, WorkoutUpdate } from "./types";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const fmtKg = (v: number): string => `${Number.isInteger(v) ? v : v.toFixed(1)}`;
export const fmtVolume = (v: number): string =>
  v >= 10000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString("en-IN");
export const fmtDate = (iso: string, pattern = "dd/MM/yyyy"): string => format(parseISO(iso), pattern);
export const fmtClock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
  return h ? `${h}:${mmss}` : mmss;
};

export const epley = (weight: number | null, reps: number | null): number => {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
};

export const workingSets = (ex: WorkoutExercise): WorkoutSet[] =>
  ex.sets.filter((s) => s.completed && s.set_type !== "W" && s.reps);

export const draftStats = (w: Workout) => {
  let sets = 0;
  let volume = 0;
  let total = 0;
  for (const ex of w.exercises) {
    total += ex.sets.length;
    for (const s of workingSets(ex)) {
      sets += 1;
      volume += (s.weight ?? 0) * (s.reps ?? 0);
    }
  }
  return { sets, volume, total };
};

export const newSet = (from?: WorkoutSet): WorkoutSet => ({
  uid: uid(),
  set_type: "N",
  weight: from?.weight ?? null,
  reps: from?.reps ?? null,
  rpe: null,
  rir: null,
  completed: false,
});

export const newWorkoutExercise = (ex: Exercise): WorkoutExercise => ({
  uid: uid(),
  exercise_id: ex.id,
  exercise_name: ex.name,
  muscle_group: ex.muscle_group,
  notes: "",
  rest_seconds: ex.muscle_group === "Quads" || ex.muscle_group === "Back" ? 150 : 120,
  effort_mode: "rpe",
  sets: [newSet(), newSet(), newSet()],
});

export const toUpdate = (w: Workout): WorkoutUpdate => ({
  name: w.name || "Workout",
  notes: w.notes,
  date: w.date,
  exercises: w.exercises,
});

export const MUSCLE_COLORS: Record<string, string> = {
  Chest: "#22C55E",
  Back: "#06B6D4",
  Shoulders: "#F59E0B",
  Quads: "#A3E635",
  Hamstrings: "#14B8A6",
  Glutes: "#F97316",
  Biceps: "#38BDF8",
  Triceps: "#FACC15",
  Core: "#FF3B30",
  Calves: "#94A3B8",
};

export const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
