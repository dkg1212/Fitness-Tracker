import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, Clock, Gauge, MoreVertical, Plus,
  StickyNote, Timer, Trash2, Zap, Target,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type { Equipment, ExerciseConfig, SetType, WorkoutExercise, WorkoutSet } from "@/lib/types";
import {
  fmtClock, fmtKg, mergeInputs, deriveWeight,
  weightNoteFor, MUSCLE_COLORS, newSet,
} from "@/lib/workout";
import SetWeightField, {
  ExerciseConfigPanel, defaultExerciseConfig,
  needsExerciseConfig, weightColLabel,
} from "@/components/WeightInputs";
import { EXERCISE_META, TIME_BASED_EXERCISES } from "@/lib/exerciseMeta";
import { cn } from "@/lib/utils";

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const RIR_OPTIONS = [0, 1, 2, 3, 4, 5];
const REST_STEPS = [60, 90, 120, 150, 180, 240, 300];

const TYPE_LABEL: Record<SetType, string> = {
  W: "Warm-up", N: "Working", D: "Drop set", F: "Failure",
};
const TYPE_COLOR: Record<SetType, string> = {
  W: "text-amber-warn", N: "text-foreground",
  D: "text-cyan-focus", F: "text-crimson",
};

// ── Reps input ────────────────────────────────────────────────────────────────
function RepsField({
  value, onChange, placeholder, testid,
}: {
  value: number | null; onChange: (v: number | null) => void;
  placeholder?: string; testid: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(value === null ? "" : String(value));
  }, [value]);
  return (
    <input
      ref={ref} type="text" inputMode="numeric" aria-label="Reps"
      value={text} placeholder={placeholder ?? "—"} data-testid={testid}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => setText(value === null ? "" : String(value))}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^\d*$/.test(raw)) return;
        setText(raw);
        if (!raw) onChange(null);
        else { const n = parseInt(raw, 10); if (!Number.isNaN(n)) onChange(n); }
      }}
      className="h-12 w-full min-w-0 rounded-xl border border-input/70 bg-background/60 text-center font-mono text-base font-semibold tabular-nums text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/40 focus:border-volt focus:ring-2 focus:ring-volt/25"
    />
  );
}

// ── Duration input (time-based exercises) ────────────────────────────────────
function DurationField({
  value, onChange, testid,
}: {
  value: number | null; onChange: (v: number | null) => void; testid: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(value === null ? "" : String(value));
  }, [value]);
  return (
    <div className="flex w-full flex-col items-center gap-0.5">
      <input
        ref={ref} type="text" inputMode="numeric" aria-label="Duration in seconds"
        value={text} placeholder="sec" data-testid={testid}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => setText(value === null ? "" : String(value))}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^\d*$/.test(raw)) return;
          setText(raw);
          if (!raw) onChange(null);
          else { const n = parseInt(raw, 10); if (!Number.isNaN(n)) onChange(n); }
        }}
        className="h-12 w-full min-w-0 rounded-xl border border-cyan-focus/50 bg-background/60 text-center font-mono text-base font-semibold tabular-nums text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/40 focus:border-cyan-focus focus:ring-2 focus:ring-cyan-focus/25"
      />
      {value !== null && (
        <span className="text-[9px] font-semibold leading-none text-cyan-focus/70">
          {value >= 60 ? fmtClock(value) : `${value}s`}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExerciseCard({
  ex, index, previous, isFirst, isLast,
  onChange, onRemove, onMove, onSetCompleted,
}: {
  ex: WorkoutExercise;
  index: number;
  previous?: WorkoutSet[];
  isFirst: boolean;
  isLast: boolean;
  onChange: (ex: WorkoutExercise) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onSetCompleted: (ex: WorkoutExercise) => void;
}) {
  const [showNotes, setShowNotes] = useState(ex.notes.length > 0);
  const activeIdx = ex.sets.findIndex((s) => !s.completed);
  const meta = EXERCISE_META[ex.exercise_name];
  const equipment = (ex.equipment as Equipment | null) ?? null;
  const showConfig = needsExerciseConfig(equipment);
  const isTimeBased = !!(meta?.isTimeBased || TIME_BASED_EXERCISES.has(ex.exercise_name));

  // Auto-init exercise_config
  useEffect(() => {
    if (showConfig && !ex.exercise_config) {
      const def = defaultExerciseConfig(equipment);
      if (def) onChange({ ...ex, exercise_config: def });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setConfig = (cfg: ExerciseConfig) => onChange({ ...ex, exercise_config: cfg });
  const setAt = (si: number, patch: Partial<WorkoutSet>) =>
    onChange({ ...ex, sets: ex.sets.map((s, i) => (i === si ? { ...s, ...patch } : s)) });

  const toggleComplete = (si: number) => {
    const s = ex.sets[si];
    if (s.completed) { setAt(si, { completed: false }); return; }
    const prev = previous?.[si];

    if (isTimeBased) {
      const duration = s.duration_seconds ?? prev?.duration_seconds ?? null;
      if (!duration) { toast.error("Enter duration before completing the set"); return; }
      let weight = s.weight;
      if (weight === null && equipment) {
        weight = deriveWeight(mergeInputs(ex.exercise_config, s.loading_inputs), equipment);
      }
      const note = s.weight_note ?? weightNoteFor(equipment) ?? null;
      const next = { ...ex, sets: ex.sets.map((x, i) => i === si ? { ...x, duration_seconds: duration, weight, completed: true, weight_note: note } : x) };
      onChange(next); onSetCompleted(next); return;
    }

    let weight = s.weight;
    if (weight === null && equipment) {
      weight = deriveWeight(mergeInputs(ex.exercise_config, s.loading_inputs), equipment);
    }
    weight = weight ?? prev?.weight ?? null;
    const reps = s.reps ?? prev?.reps ?? null;
    if (!reps) { toast.error("Enter reps before completing the set"); return; }
    const note = s.weight_note ?? weightNoteFor(equipment) ?? null;
    const next = { ...ex, sets: ex.sets.map((x, i) => i === si ? { ...x, weight, reps, completed: true, weight_note: note } : x) };
    onChange(next); onSetCompleted(next);
  };

  const setEffort = (si: number, raw: string) => {
    if (raw === "") return setAt(si, { rpe: null, rir: null });
    const v = parseFloat(raw);
    if (ex.effort_mode === "rpe") setAt(si, { rpe: v, rir: Math.max(0, Math.round((10 - v) * 10) / 10) });
    else setAt(si, { rir: v, rpe: Math.max(0, 10 - v) });
  };

  const cycleRest = () => {
    const i = REST_STEPS.indexOf(ex.rest_seconds);
    onChange({ ...ex, rest_seconds: REST_STEPS[(i + 1) % REST_STEPS.length] });
  };

  const stepWeight = (si: number, delta: number) => {
    const s = ex.sets[si];
    if (isTimeBased) {
      const cur = s.duration_seconds ?? previous?.[si]?.duration_seconds ?? 30;
      setAt(si, { duration_seconds: Math.max(5, cur + delta) });
      return;
    }
    if (equipment === "Barbell" || equipment === "Smith Machine" || equipment === "Plate-Loaded Machine") {
      const curSide = s.loading_inputs?.plates_per_side ?? 0;
      const newSide = Math.max(0, Math.round((curSide + delta / 2) * 10) / 10);
      const merged = mergeInputs(ex.exercise_config, { ...s.loading_inputs, plates_per_side: newSide, total_plates: null });
      setAt(si, { loading_inputs: { ...s.loading_inputs, plates_per_side: newSide, total_plates: null }, weight: deriveWeight(merged, equipment) });
    } else {
      const base = s.weight ?? previous?.[si]?.weight ?? 0;
      setAt(si, { weight: Math.max(0, Math.round((base + delta) * 10) / 10) });
    }
  };

  const stepReps = (si: number, delta: number) => {
    const base = ex.sets[si].reps ?? previous?.[si]?.reps ?? 0;
    setAt(si, { reps: Math.max(0, base + delta) });
  };

  let workingNo = 0;
  const p = `${index}`;

  // Grid templates
  const gridCols = isTimeBased
    ? "grid-cols-[40px_1fr_1fr_52px] sm:grid-cols-[40px_90px_1fr_1fr_52px]"
    : "grid-cols-[40px_1fr_1fr_60px_52px] sm:grid-cols-[40px_90px_1fr_1fr_60px_52px]";

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-surface-card/80 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] animate-fade-up"
      data-testid={`exercise-card-${p}`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-heading text-xl font-bold leading-tight text-foreground"
            data-testid={`exercise-card-name-${p}`}
          >
            {ex.exercise_name}
          </h3>

          {/* Badges row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: MUSCLE_COLORS[ex.muscle_group] ?? "#94A3B8" }} />
              {ex.muscle_group}
            </span>
            {equipment && (
              <span className="rounded-md bg-surface-active px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/80">
                {equipment}
              </span>
            )}
            {meta?.exerciseType && (
              <span className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                meta.exerciseType === "Compound" ? "bg-volt/15 text-volt" : "bg-cyan-focus/15 text-cyan-focus",
              )}>
                {meta.exerciseType === "Compound"
                  ? <Zap className="size-2.5" />
                  : <Target className="size-2.5" />}
                {meta.exerciseType}
              </span>
            )}
          </div>

          {/* Chips row: rest timer + effort/time badge */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={cycleRest}
              data-testid={`exercise-rest-chip-${p}`}
              className="flex h-8 items-center gap-1 rounded-full border border-border px-3 font-mono text-[11px] font-semibold text-foreground transition-colors hover:border-volt active:scale-95"
            >
              <Timer className="size-3 text-volt" /> {fmtClock(ex.rest_seconds)}
            </button>

            {isTimeBased ? (
              <span className="flex h-8 items-center gap-1 rounded-full border border-cyan-focus/30 bg-cyan-focus/8 px-3 font-mono text-[11px] font-semibold text-cyan-focus">
                <Clock className="size-3" /> time-based
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onChange({ ...ex, effort_mode: ex.effort_mode === "rpe" ? "rir" : "rpe" })}
                data-testid={`exercise-effort-toggle-${p}`}
                className="flex h-8 items-center gap-1 rounded-full border border-border px-3 font-mono text-[11px] font-semibold uppercase text-foreground transition-colors hover:border-cyan-focus active:scale-95"
              >
                <Gauge className="size-3 text-cyan-focus" /> {ex.effort_mode}
              </button>
            )}

            {meta && meta.primaryMuscles.length > 0 && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {meta.primaryMuscles.join(", ")}
              </span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid={`exercise-menu-button-${p}`}
            className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground active:scale-95"
            aria-label="Exercise options"
          >
            <MoreVertical className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setShowNotes((v) => !v)} data-testid={`exercise-menu-notes-${p}`}>
              <StickyNote className="size-4" /> {showNotes ? "Hide note" : "Add note"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isFirst} onClick={() => onMove(-1)} data-testid={`exercise-menu-up-${p}`}>
              <ArrowUp className="size-4" /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onClick={() => onMove(1)} data-testid={`exercise-menu-down-${p}`}>
              <ArrowDown className="size-4" /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onRemove} data-testid={`exercise-menu-remove-${p}`}>
              <Trash2 className="size-4" /> Remove exercise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* ── Notes ──────────────────────────────────────────────────────── */}
      {showNotes && (
        <div className="px-4 pb-3">
          <Textarea
            value={ex.notes}
            onChange={(e) => onChange({ ...ex, notes: e.target.value })}
            placeholder="Cues, seat height, how it felt…"
            className="min-h-16 resize-none bg-background/50 text-sm"
            data-testid={`exercise-notes-input-${p}`}
          />
        </div>
      )}

      {/* ── Exercise-level config (bar / BW) — once per card ───────────── */}
      {showConfig && (
        <ExerciseConfigPanel
          equipment={equipment as Equipment}
          config={ex.exercise_config ?? null}
          onChange={setConfig}
        />
      )}

      {/* ── Column headers ─────────────────────────────────────────────── */}
      <div className={cn("grid items-center gap-2 px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground", gridCols)}>
        <span className="text-center">Set</span>
        <span className="hidden text-left sm:block">Previous</span>
        <span className="text-center">{isTimeBased ? "Duration" : weightColLabel(equipment)}</span>
        <span className="text-center">{isTimeBased ? "BW / reps" : "Reps"}</span>
        {!isTimeBased && <span className="text-center">{ex.effort_mode}</span>}
        <span className="text-center">✓</span>
      </div>

      {/* ── Set rows ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 px-2 pb-2">
        {ex.sets.map((s, si) => {
          if (s.set_type !== "W") workingNo += 1;
          const label = s.set_type === "N" ? String(workingNo) : s.set_type;
          const prev = previous?.[si];
          const id = `${p}-${si}`;
          const effortVal = ex.effort_mode === "rpe" ? s.rpe : s.rir;
          const isActive = si === activeIdx;

          return (
            <div key={s.uid}>
              <div
                data-testid={`set-row-${id}`}
                className={cn(
                  "grid items-center gap-2 rounded-2xl border border-transparent px-1.5 py-2 transition-colors duration-200",
                  gridCols,
                  s.completed && "border-volt/50 bg-volt/[0.10]",
                  !s.completed && isActive && "bg-surface-active/50",
                )}
              >
                {/* Set type */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    data-testid={`set-row-type-button-${id}`}
                    className={cn("grid h-11 w-11 place-items-center rounded-xl bg-background/50 font-mono text-sm font-bold transition-colors hover:bg-surface-active active:scale-95", TYPE_COLOR[s.set_type])}
                    aria-label={`Set ${label} type`}
                  >
                    {label}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {(Object.keys(TYPE_LABEL) as SetType[]).map((t) => (
                      <DropdownMenuItem key={t} onClick={() => setAt(si, { set_type: t })} data-testid={`set-type-option-${t}-${id}`}>
                        <span className={cn("w-4 font-mono font-bold", TYPE_COLOR[t])}>{t}</span>
                        {TYPE_LABEL[t]}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onChange({ ...ex, sets: ex.sets.filter((_, i) => i !== si) })}
                      data-testid={`set-delete-${id}`}
                    >
                      <Trash2 className="size-4" /> Delete set
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Previous (desktop) */}
                <button
                  type="button"
                  disabled={!prev}
                  onClick={() => prev && setAt(si, {
                    weight: prev.weight, reps: prev.reps,
                    duration_seconds: prev.duration_seconds ?? null,
                    loading_inputs: prev.loading_inputs ?? null,
                    weight_note: prev.weight_note ?? null,
                  })}
                  data-testid={`set-row-previous-${id}`}
                  className="hidden h-11 truncate rounded-xl text-left font-mono text-xs text-muted-foreground transition-colors enabled:hover:text-foreground sm:block"
                  title="Tap to copy"
                >
                  {prev
                    ? isTimeBased
                      ? (prev.duration_seconds != null ? fmtClock(prev.duration_seconds) : "—")
                      : `${fmtKg(prev.weight ?? 0)} × ${prev.reps ?? 0}`
                    : "—"}
                </button>

                {/* Weight or Duration */}
                {isTimeBased ? (
                  <DurationField
                    value={s.duration_seconds ?? null}
                    onChange={(v) => setAt(si, { duration_seconds: v })}
                    testid={`set-row-duration-input-${id}`}
                  />
                ) : (
                  <SetWeightField
                    equipment={equipment}
                    config={ex.exercise_config}
                    set={s}
                    prevSet={prev}
                    onChange={(patch) => setAt(si, patch)}
                  />
                )}

                {/* Reps (or BW display for time-based) */}
                {isTimeBased ? (
                  <div className="flex flex-col items-center gap-0.5">
                    {equipment === "Bodyweight" && ex.exercise_config?.bodyweight != null ? (
                      <>
                        <span className="font-mono text-sm font-bold text-foreground">
                          {fmtKg(ex.exercise_config.bodyweight)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">kg BW</span>
                      </>
                    ) : (
                      <RepsField
                        value={s.reps}
                        onChange={(v) => setAt(si, { reps: v })}
                        placeholder="reps"
                        testid={`set-row-reps-input-${id}`}
                      />
                    )}
                  </div>
                ) : (
                  <RepsField
                    value={s.reps}
                    onChange={(v) => setAt(si, { reps: v })}
                    placeholder={prev?.reps != null ? String(prev.reps) : "—"}
                    testid={`set-row-reps-input-${id}`}
                  />
                )}

                {/* Effort (rep-based only) */}
                {!isTimeBased && (
                  <select
                    value={effortVal ?? ""}
                    onChange={(e) => setEffort(si, e.target.value)}
                    data-testid={`set-row-effort-select-${id}`}
                    aria-label={ex.effort_mode.toUpperCase()}
                    className="h-12 w-full rounded-xl border border-input/70 bg-background/60 text-center font-mono text-sm font-semibold text-foreground outline-none transition-[border-color] focus:border-cyan-focus"
                  >
                    <option value="">–</option>
                    {(ex.effort_mode === "rpe" ? RPE_OPTIONS : RIR_OPTIONS).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                )}

                {/* Complete */}
                <button
                  type="button"
                  onClick={() => toggleComplete(si)}
                  aria-pressed={s.completed}
                  aria-label={s.completed ? "Undo complete" : "Complete set"}
                  data-testid={`set-row-complete-checkbox-${id}`}
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-2xl border-2 transition-[background-color,border-color,transform] duration-150 active:scale-90",
                    s.completed
                      ? "animate-set-pop border-volt bg-volt text-volt-ink shadow-[0_0_12px_rgba(34,197,94,0.35)]"
                      : "border-input bg-background/40 text-muted-foreground hover:border-volt",
                  )}
                >
                  <Check className="size-5" strokeWidth={3} />
                </button>
              </div>

              {/* ── Steppers ─────────────────────────────────────────── */}
              {isActive && (
                <div className="mt-1 grid grid-cols-4 gap-1.5 px-1.5 pb-1" data-testid={`set-stepper-${id}`}>
                  {isTimeBased ? (
                    [
                      { label: "−15s", d: -15 }, { label: "+15s", d: 15 },
                      { label: "−5s",  d: -5  }, { label: "+5s",  d: 5  },
                    ].map(({ label, d }) => (
                      <button key={label} type="button"
                        onClick={() => { const cur = s.duration_seconds ?? 30; setAt(si, { duration_seconds: Math.max(5, cur + d) }); }}
                        className="h-11 rounded-xl border border-cyan-focus/30 bg-background/40 font-mono text-xs font-semibold text-muted-foreground transition-colors hover:border-cyan-focus/60 hover:text-foreground active:scale-95 active:bg-surface-active"
                      >
                        {label}
                      </button>
                    ))
                  ) : (
                    [
                      { label: "−2.5",  action: () => stepWeight(si, -2.5) },
                      { label: "+2.5",  action: () => stepWeight(si,  2.5) },
                      { label: "−1 rep",action: () => stepReps(si, -1) },
                      { label: "+1 rep",action: () => stepReps(si,  1) },
                    ].map(({ label, action }) => (
                      <button key={label} type="button" onClick={action}
                        className="h-11 rounded-xl border border-border/70 bg-background/40 font-mono text-xs font-semibold text-muted-foreground transition-colors hover:border-volt/60 hover:text-foreground active:scale-95 active:bg-surface-active"
                      >
                        {label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add set ────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => onChange({ ...ex, sets: [...ex.sets, newSet(ex.sets[ex.sets.length - 1])] })}
        data-testid={`exercise-add-set-button-${p}`}
        className="flex h-13 w-full items-center justify-center gap-2 border-t border-border/60 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-active hover:text-volt active:bg-surface-active"
      >
        <Plus className="size-4" /> Add set
      </button>
    </section>
  );
}
