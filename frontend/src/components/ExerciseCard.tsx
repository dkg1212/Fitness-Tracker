import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, MoreVertical, Plus,
  StickyNote, Timer, Trash2, Gauge, Zap, Target,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type { Equipment, ExerciseConfig, SetType, WorkoutExercise, WorkoutSet } from "@/lib/types";
import { fmtClock, fmtKg, mergeInputs, deriveWeight, weightNoteFor, MUSCLE_COLORS, newSet } from "@/lib/workout";
import SetWeightField, {
  ExerciseConfigPanel,
  defaultExerciseConfig,
  needsExerciseConfig,
  weightColLabel,
} from "@/components/WeightInputs";
import { EXERCISE_META } from "@/lib/exerciseMeta";
import { cn } from "@/lib/utils";

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const RIR_OPTIONS = [0, 1, 2, 3, 4, 5];
const REST_STEPS = [60, 90, 120, 150, 180, 240, 300];

const TYPE_LABEL: Record<SetType, string> = { W: "Warm-up", N: "Working", D: "Drop set", F: "Failure" };
const TYPE_COLOR: Record<SetType, string> = {
  W: "text-amber-warn",
  N: "text-foreground",
  D: "text-cyan-focus",
  F: "text-crimson",
};

/** Plain numeric input for the reps column */
function RepsField({
  value,
  onChange,
  placeholder,
  testid,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  testid: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(value === null ? "" : String(value));
  }, [value]);
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      aria-label="Reps"
      value={text}
      placeholder={placeholder}
      data-testid={testid}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => setText(value === null ? "" : String(value))}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^\d*$/.test(raw)) return;
        setText(raw);
        if (!raw) onChange(null);
        else {
          const n = parseInt(raw, 10);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
      className="h-12 w-full min-w-0 rounded-xl border border-input/70 bg-background/60 text-center font-mono text-base font-semibold tabular-nums text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/40 focus:border-volt focus:ring-2 focus:ring-volt/25"
    />
  );
}

export default function ExerciseCard({
  ex,
  index,
  previous,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMove,
  onSetCompleted,
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

  // Auto-initialise exercise_config on first render if needed and not set
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
    if (s.completed) {
      setAt(si, { completed: false });
      return;
    }
    const prev = previous?.[si];
    // For equipment-aware sets, derive weight from merged inputs; fall back to stored weight
    let weight = s.weight;
    if (weight === null && equipment) {
      const merged = mergeInputs(ex.exercise_config, s.loading_inputs);
      weight = deriveWeight(merged, equipment);
    }
    weight = weight ?? prev?.weight ?? null;
    const reps = s.reps ?? prev?.reps ?? null;
    if (!reps) {
      toast.error("Enter reps before completing the set");
      return;
    }
    const note = s.weight_note ?? weightNoteFor(equipment) ?? null;
    const next = {
      ...ex,
      sets: ex.sets.map((x, i) =>
        i === si ? { ...x, weight, reps, completed: true, weight_note: note } : x,
      ),
    };
    onChange(next);
    onSetCompleted(next);
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
    const base = s.weight ?? previous?.[si]?.weight ?? 0;
    const next = Math.max(0, Math.round((base + delta) * 10) / 10);

    // For plate-based exercises, adjust plates_per_side
    if (
      equipment === "Barbell" ||
      equipment === "Smith Machine" ||
      equipment === "Plate-Loaded Machine"
    ) {
      const curSide = s.loading_inputs?.plates_per_side ?? 0;
      const newSide = Math.max(0, Math.round((curSide + delta / 2) * 10) / 10);
      const merged = mergeInputs(ex.exercise_config, { ...s.loading_inputs, plates_per_side: newSide, total_plates: null });
      const derived = deriveWeight(merged, equipment);
      setAt(si, { loading_inputs: { ...s.loading_inputs, plates_per_side: newSide, total_plates: null }, weight: derived });
    } else {
      setAt(si, { weight: next });
    }
  };

  const stepReps = (si: number, delta: number) => {
    const s = ex.sets[si];
    const base = s.reps ?? previous?.[si]?.reps ?? 0;
    setAt(si, { reps: Math.max(0, base + delta) });
  };

  let workingNo = 0;
  const p = `${index}`;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-surface-card/80 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] animate-fade-up"
      data-testid={`exercise-card-${p}`}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-heading text-xl font-bold leading-tight text-foreground"
            data-testid={`exercise-card-name-${p}`}
          >
            {ex.exercise_name}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {/* Muscle group */}
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: MUSCLE_COLORS[ex.muscle_group] ?? "#94A3B8" }} />
              {ex.muscle_group}
            </span>
            {/* Equipment */}
            {equipment && (
              <span className="rounded-md bg-surface-active px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/80">
                {equipment}
              </span>
            )}
            {/* Compound / Isolation */}
            {meta?.exerciseType && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  meta.exerciseType === "Compound"
                    ? "bg-volt/15 text-volt"
                    : "bg-cyan-focus/15 text-cyan-focus",
                )}
              >
                {meta.exerciseType === "Compound" ? <Zap className="size-2.5" /> : <Target className="size-2.5" />}
                {meta.exerciseType}
              </span>
            )}
          </div>

          {/* Rest + effort chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={cycleRest}
              data-testid={`exercise-rest-chip-${p}`}
              className="flex h-8 items-center gap-1 rounded-full border border-border px-3 font-mono text-[11px] font-semibold text-foreground transition-colors hover:border-volt active:scale-95"
            >
              <Timer className="size-3 text-volt" /> {fmtClock(ex.rest_seconds)}
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...ex, effort_mode: ex.effort_mode === "rpe" ? "rir" : "rpe" })}
              data-testid={`exercise-effort-toggle-${p}`}
              className="flex h-8 items-center gap-1 rounded-full border border-border px-3 font-mono text-[11px] font-semibold uppercase text-foreground transition-colors hover:border-cyan-focus active:scale-95"
            >
              <Gauge className="size-3 text-cyan-focus" /> {ex.effort_mode}
            </button>
            {/* Primary muscles inline — only on larger screens, not critical on mobile */}
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

      {/* ── Notes ───────────────────────────────────────────────────────── */}
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

      {/* ── Exercise-level config (bar weight / bodyweight) — shown ONCE ── */}
      {showConfig && (
        <ExerciseConfigPanel
          equipment={equipment as Equipment}
          config={ex.exercise_config ?? null}
          onChange={setConfig}
        />
      )}

      {/* ── Column headers ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-[40px_1fr_1fr_60px_52px] items-center gap-2 px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:grid-cols-[40px_90px_1fr_1fr_60px_52px]">
        <span className="text-center">Set</span>
        <span className="hidden text-left sm:block">Previous</span>
        <span className="text-center">{weightColLabel(equipment)}</span>
        <span className="text-center">Reps</span>
        <span className="text-center">{ex.effort_mode}</span>
        <span className="text-center">✓</span>
      </div>

      {/* ── Set rows ─────────────────────────────────────────────────────── */}
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
                  "grid grid-cols-[40px_1fr_1fr_60px_52px] items-center gap-2 rounded-2xl border border-transparent px-1.5 py-2 transition-colors duration-200 sm:grid-cols-[40px_90px_1fr_1fr_60px_52px]",
                  s.completed && "border-volt/50 bg-volt/[0.10]",
                  !s.completed && isActive && "bg-surface-active/50",
                )}
              >
                {/* Set type button */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    data-testid={`set-row-type-button-${id}`}
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-xl bg-background/50 font-mono text-sm font-bold transition-colors hover:bg-surface-active active:scale-95",
                      TYPE_COLOR[s.set_type],
                    )}
                    aria-label={`Set ${label} type`}
                  >
                    {label}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {(Object.keys(TYPE_LABEL) as SetType[]).map((t) => (
                      <DropdownMenuItem
                        key={t}
                        onClick={() => setAt(si, { set_type: t })}
                        data-testid={`set-type-option-${t}-${id}`}
                      >
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

                {/* Previous set — desktop only */}
                <button
                  type="button"
                  disabled={!prev}
                  onClick={() =>
                    prev &&
                    setAt(si, {
                      weight: prev.weight,
                      reps: prev.reps,
                      loading_inputs: prev.loading_inputs ?? null,
                      weight_note: prev.weight_note ?? null,
                    })
                  }
                  data-testid={`set-row-previous-${id}`}
                  className="hidden h-11 truncate rounded-xl text-left font-mono text-xs text-muted-foreground transition-colors enabled:hover:text-foreground sm:block"
                  title="Tap to copy"
                >
                  {prev ? (
                    <span>
                      {fmtKg(prev.weight ?? 0)}
                      <span className="mx-0.5 text-muted-foreground/50">×</span>
                      {prev.reps ?? 0}
                    </span>
                  ) : (
                    "—"
                  )}
                </button>

                {/* Weight — equipment-aware */}
                <SetWeightField
                  equipment={equipment}
                  config={ex.exercise_config}
                  set={s}
                  prevSet={prev}
                  onChange={(patch) => setAt(si, patch)}
                />

                {/* Reps */}
                <RepsField
                  value={s.reps}
                  onChange={(v) => setAt(si, { reps: v })}
                  placeholder={prev?.reps != null ? String(prev.reps) : "—"}
                  testid={`set-row-reps-input-${id}`}
                />

                {/* Effort select */}
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

              {/* ── Quick-adjust steppers (active set only) ─────────────── */}
              {isActive && (
                <div
                  className="mt-1 grid grid-cols-4 gap-1.5 px-1.5 pb-1"
                  data-testid={`set-stepper-${id}`}
                >
                  {(
                    [
                      { label: "−2.5", action: () => stepWeight(si, -2.5) },
                      { label: "+2.5", action: () => stepWeight(si, 2.5) },
                      { label: "−1 rep", action: () => stepReps(si, -1) },
                      { label: "+1 rep", action: () => stepReps(si, 1) },
                    ] as const
                  ).map(({ label, action }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={action}
                      className="h-11 rounded-xl border border-border/70 bg-background/40 font-mono text-xs font-semibold text-muted-foreground transition-colors hover:border-volt/60 hover:text-foreground active:scale-95 active:bg-surface-active"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add set ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() =>
          onChange({ ...ex, sets: [...ex.sets, newSet(ex.sets[ex.sets.length - 1])] })
        }
        data-testid={`exercise-add-set-button-${p}`}
        className="flex h-13 w-full items-center justify-center gap-2 border-t border-border/60 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-active hover:text-volt active:bg-surface-active"
      >
        <Plus className="size-4" /> Add set
      </button>
    </section>
  );
}
