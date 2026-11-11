/**
 * Vitest unit tests for lib/workout.ts
 * Covers: calcBarbellLoad, calcBodyweightLoad, deriveWeight, epley,
 *         fmtVolume, fmtClock, workingSets, draftStats, mergeInputs,
 *         weightNoteFor, newSet, newWorkoutExercise.
 */
import { describe, it, expect } from "vitest";
import {
  calcBarbellLoad,
  calcBodyweightLoad,
  deriveWeight,
  epley,
  fmtClock,
  fmtVolume,
  mergeInputs,
  workingSets,
  draftStats,
  weightNoteFor,
  newSet,
  newWorkoutExercise,
  slug,
  WEEKDAYS,
  WEEKDAYS_SHORT,
} from "../workout";
import type {
  LoadingInputs,
  ExerciseConfig,
  Workout,
  WorkoutExercise,
  Exercise,
} from "../types";

// ── calcBarbellLoad ────────────────────────────────────────────────────────────

describe("calcBarbellLoad", () => {
  it("bar + plates per side", () => {
    const inputs: LoadingInputs = { bar_weight: 20, plates_per_side: 25 };
    expect(calcBarbellLoad(inputs)).toBe(70); // 20 + 25*2
  });

  it("bar + total plates", () => {
    const inputs: LoadingInputs = { bar_weight: 20, total_plates: 50 };
    expect(calcBarbellLoad(inputs)).toBe(70); // 20 + 50
  });

  it("total plates takes priority over per-side when both given", () => {
    const inputs: LoadingInputs = { bar_weight: 20, plates_per_side: 10, total_plates: 40 };
    expect(calcBarbellLoad(inputs)).toBe(60); // 20 + 40 (total_plates wins)
  });

  it("bar only, no plates", () => {
    const inputs: LoadingInputs = { bar_weight: 20 };
    expect(calcBarbellLoad(inputs)).toBe(20);
  });

  it("unknown bar (Smith) — plates only", () => {
    const inputs: LoadingInputs = { bar_weight: null, bar_known: false, plates_per_side: 30 };
    expect(calcBarbellLoad(inputs)).toBe(60); // 30*2, no bar
  });

  it("unknown bar with total_plates", () => {
    const inputs: LoadingInputs = { bar_weight: null, bar_known: false, total_plates: 45 };
    expect(calcBarbellLoad(inputs)).toBe(45);
  });

  it("bar known but no value yet returns null", () => {
    const inputs: LoadingInputs = { bar_weight: null, bar_known: true };
    expect(calcBarbellLoad(inputs)).toBeNull();
  });

  it("no inputs at all returns null", () => {
    const inputs: LoadingInputs = {};
    expect(calcBarbellLoad(inputs)).toBeNull();
  });
});

// ── calcBodyweightLoad ────────────────────────────────────────────────────────

describe("calcBodyweightLoad", () => {
  it("normal mode returns bodyweight", () => {
    const inputs: LoadingInputs = { bodyweight: 75, bw_mode: "normal" };
    expect(calcBodyweightLoad(inputs)).toBe(75);
  });

  it("weighted mode adds weight", () => {
    const inputs: LoadingInputs = { bodyweight: 75, bw_mode: "weighted", added_weight: 20 };
    expect(calcBodyweightLoad(inputs)).toBe(95);
  });

  it("assisted mode subtracts assistance", () => {
    const inputs: LoadingInputs = { bodyweight: 75, bw_mode: "assisted", assistance_weight: 30 };
    expect(calcBodyweightLoad(inputs)).toBe(45);
  });

  it("assisted mode never goes negative", () => {
    const inputs: LoadingInputs = { bodyweight: 50, bw_mode: "assisted", assistance_weight: 80 };
    expect(calcBodyweightLoad(inputs)).toBe(0); // Math.max(0, 50-80)
  });

  it("no bodyweight returns null", () => {
    const inputs: LoadingInputs = { bw_mode: "normal" };
    expect(calcBodyweightLoad(inputs)).toBeNull();
  });

  it("default mode is normal", () => {
    const inputs: LoadingInputs = { bodyweight: 70 };
    expect(calcBodyweightLoad(inputs)).toBe(70);
  });
});

// ── deriveWeight ──────────────────────────────────────────────────────────────

describe("deriveWeight", () => {
  it("Barbell", () => {
    const inputs: LoadingInputs = { bar_weight: 20, plates_per_side: 25 };
    expect(deriveWeight(inputs, "Barbell")).toBe(70);
  });

  it("Smith Machine uses barbell calc", () => {
    const inputs: LoadingInputs = { bar_weight: 15, plates_per_side: 20 };
    expect(deriveWeight(inputs, "Smith Machine")).toBe(55);
  });

  it("Dumbbell returns per_dumbbell", () => {
    const inputs: LoadingInputs = { per_dumbbell: 22.5 };
    expect(deriveWeight(inputs, "Dumbbell")).toBe(22.5);
  });

  it("Cable returns stack_weight", () => {
    const inputs: LoadingInputs = { stack_weight: 40 };
    expect(deriveWeight(inputs, "Cable")).toBe(40);
  });

  it("Bodyweight uses bodyweight calc", () => {
    const inputs: LoadingInputs = { bodyweight: 80, bw_mode: "weighted", added_weight: 15 };
    expect(deriveWeight(inputs, "Bodyweight")).toBe(95);
  });

  it("Resistance Band returns band_resistance", () => {
    const inputs: LoadingInputs = { band_resistance: 15 };
    expect(deriveWeight(inputs, "Resistance Band")).toBe(15);
  });

  it("Resistance Band with no numeric returns null", () => {
    const inputs: LoadingInputs = { band_level: "medium" };
    expect(deriveWeight(inputs, "Resistance Band")).toBeNull();
  });

  it("null equipment returns null", () => {
    expect(deriveWeight({}, null)).toBeNull();
  });
});

// ── epley ─────────────────────────────────────────────────────────────────────

describe("epley", () => {
  it("1 rep returns weight", () => {
    expect(epley(100, 1)).toBe(100);
  });

  it("8 reps at 60 = 76", () => {
    expect(epley(60, 8)).toBe(76); // 60 * (1 + 8/30) = 76
  });

  it("zero weight returns 0", () => {
    expect(epley(0, 10)).toBe(0);
  });

  it("null weight returns 0", () => {
    expect(epley(null, 10)).toBe(0);
  });

  it("null reps returns 0", () => {
    expect(epley(60, null)).toBe(0);
  });

  it("zero reps returns 0", () => {
    expect(epley(60, 0)).toBe(0);
  });

  it("rounded to 1 decimal", () => {
    const result = epley(50, 5); // 50 * (1 + 5/30) = 58.333...
    expect(result).toBe(58.3);
  });
});

// ── fmtVolume ─────────────────────────────────────────────────────────────────

describe("fmtVolume", () => {
  it("formats small numbers with locale", () => {
    expect(fmtVolume(500)).toBe("500");
  });

  it("formats thousands with k suffix", () => {
    expect(fmtVolume(12500)).toBe("12.5k");
  });

  it("formats exactly 10000 as k", () => {
    expect(fmtVolume(10000)).toBe("10.0k");
  });
});

// ── fmtClock ──────────────────────────────────────────────────────────────────

describe("fmtClock", () => {
  it("under a minute", () => {
    expect(fmtClock(45)).toBe("0:45");
  });

  it("exactly one minute", () => {
    expect(fmtClock(60)).toBe("1:00");
  });

  it("minutes and seconds", () => {
    expect(fmtClock(125)).toBe("2:05");
  });

  it("over an hour shows h:mm:ss", () => {
    expect(fmtClock(3725)).toBe("1:02:05"); // 1h 2m 5s
  });

  it("negative clamps to 0", () => {
    expect(fmtClock(-10)).toBe("0:00");
  });
});

// ── workingSets ────────────────────────────────────────────────────────────────

describe("workingSets", () => {
  const makeEx = (sets: Partial<WorkoutExercise["sets"][0]>[]) => ({
    uid: "ex1",
    exercise_id: "e1",
    exercise_name: "Squat",
    muscle_group: "Quads",
    equipment: "Barbell" as const,
    exercise_config: null,
    notes: "",
    rest_seconds: 120,
    effort_mode: "rpe" as const,
    sets: sets.map((s) => ({
      uid: "s1",
      set_type: s.set_type ?? ("N" as const),
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      rpe: null,
      rir: null,
      completed: s.completed ?? true,
      loading_inputs: null,
      weight_note: null,
      duration_seconds: s.duration_seconds ?? null,
    })),
  });

  it("includes completed normal sets with reps", () => {
    const ex = makeEx([{ weight: 60, reps: 8 }]);
    expect(workingSets(ex)).toHaveLength(1);
  });

  it("excludes warm-up sets", () => {
    const ex = makeEx([{ weight: 60, reps: 8, set_type: "W" as const }]);
    expect(workingSets(ex)).toHaveLength(0);
  });

  it("excludes incomplete sets", () => {
    const ex = makeEx([{ weight: 60, reps: 8, completed: false }]);
    expect(workingSets(ex)).toHaveLength(0);
  });

  it("excludes sets without reps AND without duration", () => {
    const ex = makeEx([{ weight: 60, reps: null }]);
    expect(workingSets(ex)).toHaveLength(0);
  });

  it("includes duration-only sets (Finding 4 — Plank etc.)", () => {
    const ex = makeEx([{ weight: null, reps: null, duration_seconds: 60 }]);
    expect(workingSets(ex)).toHaveLength(1);
  });

  it("excludes duration-only sets with zero duration", () => {
    const ex = makeEx([{ weight: null, reps: null, duration_seconds: 0 }]);
    expect(workingSets(ex)).toHaveLength(0);
  });

  it("includes drop sets", () => {
    const ex = makeEx([{ weight: 40, reps: 12, set_type: "D" as const }]);
    expect(workingSets(ex)).toHaveLength(1);
  });

  it("includes failure sets", () => {
    const ex = makeEx([{ weight: 50, reps: 6, set_type: "F" as const }]);
    expect(workingSets(ex)).toHaveLength(1);
  });
});

// ── draftStats ────────────────────────────────────────────────────────────────

describe("draftStats", () => {
  it("counts working sets and volume", () => {
    const w: Workout = {
      id: "w1", name: "Test", date: "2026-01-01", status: "active",
      template_id: null, notes: "",
      exercises: [{
        uid: "e1", exercise_id: "ex1", exercise_name: "Bench",
        muscle_group: "Chest", equipment: "Barbell", exercise_config: null,
        notes: "", rest_seconds: 120, effort_mode: "rpe",
        sets: [
          { uid: "s1", set_type: "N", weight: 60, reps: 8, rpe: null, rir: null, completed: true, loading_inputs: null, weight_note: null, duration_seconds: null },
          { uid: "s2", set_type: "N", weight: 60, reps: 8, rpe: null, rir: null, completed: true, loading_inputs: null, weight_note: null, duration_seconds: null },
          { uid: "s3", set_type: "W", weight: 30, reps: 8, rpe: null, rir: null, completed: true, loading_inputs: null, weight_note: null, duration_seconds: null },
          { uid: "s4", set_type: "N", weight: 60, reps: 8, rpe: null, rir: null, completed: false, loading_inputs: null, weight_note: null, duration_seconds: null },
        ],
      }],
      started_at: "2026-01-01T18:00:00Z",
      finished_at: null,
      updated_at: "2026-01-01T18:00:00Z",
    };
    const stats = draftStats(w);
    expect(stats.sets).toBe(2);   // 2 working sets (warm-up and incomplete excluded)
    expect(stats.volume).toBe(960); // 2 × (60 × 8)
    expect(stats.total).toBe(4);   // 4 total sets
  });

  it("empty workout returns zeros", () => {
    const w: Workout = {
      id: "w1", name: "Test", date: "2026-01-01", status: "active",
      template_id: null, notes: "", exercises: [],
      started_at: "2026-01-01T18:00:00Z", finished_at: null, updated_at: "2026-01-01T18:00:00Z",
    };
    expect(draftStats(w)).toEqual({ sets: 0, volume: 0, total: 0 });
  });

  it("duration-only sets count in draftStats (Finding 4)", () => {
    // Plank: 60 s, no reps, no weight → counts as 1 working set, volume=0
    const w: Workout = {
      id: "w1", name: "Test", date: "2026-01-01", status: "active",
      template_id: null, notes: "",
      exercises: [{
        uid: "e1", exercise_id: "ex1", exercise_name: "Plank",
        muscle_group: "Core", equipment: "Bodyweight", exercise_config: null,
        notes: "", rest_seconds: 60, effort_mode: "rpe",
        sets: [
          { uid: "s1", set_type: "N", weight: null, reps: null, rpe: null, rir: null,
            completed: true, loading_inputs: null, weight_note: null, duration_seconds: 60 },
          { uid: "s2", set_type: "W", weight: null, reps: null, rpe: null, rir: null,
            completed: true, loading_inputs: null, weight_note: null, duration_seconds: 30 },
        ],
      }],
      started_at: "2026-01-01T18:00:00Z", finished_at: null, updated_at: "2026-01-01T18:00:00Z",
    };
    const stats = draftStats(w);
    expect(stats.sets).toBe(1);   // 1 working set (warmup excluded)
    expect(stats.volume).toBe(0); // no weight × reps
    expect(stats.total).toBe(2);  // 2 total sets
  });
});

// ── mergeInputs ───────────────────────────────────────────────────────────────

describe("mergeInputs", () => {
  it("merges config constants with per-set variables", () => {
    const config: ExerciseConfig = { bar_weight: 20 };
    const setInputs: LoadingInputs = { plates_per_side: 25 };
    const merged = mergeInputs(config, setInputs);
    expect(merged.bar_weight).toBe(20);
    expect(merged.plates_per_side).toBe(25);
  });

  it("per-set inputs override config for the same key", () => {
    const config: ExerciseConfig = { bar_weight: 20 };
    const setInputs: LoadingInputs = { bar_weight: 25 }; // override
    const merged = mergeInputs(config, setInputs);
    expect(merged.bar_weight).toBe(25);
  });

  it("null config and null inputs return empty object", () => {
    expect(mergeInputs(null, null)).toEqual({});
  });
});

// ── weightNoteFor ──────────────────────────────────────────────────────────────

describe("weightNoteFor", () => {
  it("Barbell", () => {
    expect(weightNoteFor("Barbell")).toBe("total barbell load");
  });
  it("Dumbbell", () => {
    expect(weightNoteFor("Dumbbell")).toBe("per dumbbell");
  });
  it("Bodyweight", () => {
    expect(weightNoteFor("Bodyweight")).toBe("effective load");
  });
  it("Resistance Band", () => {
    expect(weightNoteFor("Resistance Band")).toBe("band resistance");
  });
  it("null equipment returns empty string", () => {
    expect(weightNoteFor(null)).toBe("");
  });
});

// ── newSet ────────────────────────────────────────────────────────────────────

describe("newSet", () => {
  it("creates a default set with uid", () => {
    const s = newSet();
    expect(s.uid).toBeTruthy();
    expect(s.set_type).toBe("N");
    expect(s.completed).toBe(false);
    expect(s.weight).toBeNull();
    expect(s.reps).toBeNull();
  });

  it("carries over weight and reps from previous set", () => {
    const prev = { uid: "old", set_type: "N" as const, weight: 60, reps: 8, rpe: null, rir: null, completed: true, loading_inputs: null, weight_note: null, duration_seconds: null };
    const s = newSet(prev);
    expect(s.weight).toBe(60);
    expect(s.reps).toBe(8);
    expect(s.uid).not.toBe("old"); // new uid
  });

  it("does not carry over rpe/rir/completed", () => {
    const prev = { uid: "old", set_type: "N" as const, weight: 60, reps: 8, rpe: 8, rir: 2, completed: true, loading_inputs: null, weight_note: null, duration_seconds: null };
    const s = newSet(prev);
    expect(s.rpe).toBeNull();
    expect(s.rir).toBeNull();
    expect(s.completed).toBe(false);
  });
});

// ── newWorkoutExercise ────────────────────────────────────────────────────────

describe("newWorkoutExercise", () => {
  it("creates 3 default sets", () => {
    const ex: Exercise = {
      id: "ex1", name: "Squat", muscle_group: "Quads", equipment: "Barbell",
      is_custom: false, exercise_type: "Compound", primary_muscles: ["Quadriceps"], secondary_muscles: [],
    };
    const wex = newWorkoutExercise(ex);
    expect(wex.exercise_id).toBe("ex1");
    expect(wex.exercise_name).toBe("Squat");
    expect(wex.equipment).toBe("Barbell");
    expect(wex.sets).toHaveLength(3);
    expect(wex.exercise_config).toBeNull();
  });

  it("assigns longer rest for Quads and Back", () => {
    const squat: Exercise = {
      id: "ex1", name: "Squat", muscle_group: "Quads", equipment: "Barbell",
      is_custom: false, exercise_type: "Compound", primary_muscles: [], secondary_muscles: [],
    };
    const curl: Exercise = {
      id: "ex2", name: "Curl", muscle_group: "Biceps", equipment: "Dumbbell",
      is_custom: false, exercise_type: "Isolation", primary_muscles: [], secondary_muscles: [],
    };
    expect(newWorkoutExercise(squat).rest_seconds).toBe(150);
    expect(newWorkoutExercise(curl).rest_seconds).toBe(120);
  });
});

// ── slug ───────────────────────────────────────────────────────────────────────

describe("slug", () => {
  it("lowercases and hyphenates", () => {
    expect(slug("Barbell Bench Press")).toBe("barbell-bench-press");
  });
  it("strips leading/trailing hyphens", () => {
    expect(slug("  Hello World  ")).toBe("hello-world");
  });
});

// ── Constants ──────────────────────────────────────────────────────────────────

describe("WEEKDAYS constants", () => {
  it("WEEKDAYS has 7 entries starting Monday", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe("Monday");
    expect(WEEKDAYS[6]).toBe("Sunday");
  });
  it("WEEKDAYS_SHORT has 7 entries", () => {
    expect(WEEKDAYS_SHORT).toHaveLength(7);
    expect(WEEKDAYS_SHORT[0]).toBe("Mon");
  });
});
