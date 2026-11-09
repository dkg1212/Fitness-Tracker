import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, MoreVertical, Plus, StickyNote, Timer, Trash2, Gauge } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type { SetType, WorkoutExercise, WorkoutSet } from "@/lib/types";
import { fmtClock, fmtKg, MUSCLE_COLORS, newSet } from "@/lib/workout";
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

/** Numeric input that keeps its own text while typing ("82." stays) and syncs from props otherwise. */
function NumField({
  value,
  onChange,
  placeholder,
  decimal,
  testid,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  decimal?: boolean;
  testid: string;
  label: string;
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
      inputMode={decimal ? "decimal" : "numeric"}
      aria-label={label}
      value={text}
      placeholder={placeholder}
      data-testid={testid}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => setText(value === null ? "" : String(value))}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        if (raw === "" || raw === ".") onChange(null);
        else {
          const n = decimal ? parseFloat(raw) : parseInt(raw, 10);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
      className="h-12 w-full min-w-0 rounded-md border border-input/70 bg-background/60 text-center font-mono text-base font-semibold tabular-nums outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/45 focus:border-volt focus:ring-2 focus:ring-volt/30"
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

  const setAt = (si: number, patch: Partial<WorkoutSet>) =>
    onChange({ ...ex, sets: ex.sets.map((s, i) => (i === si ? { ...s, ...patch } : s)) });

  const toggleComplete = (si: number) => {
    const s = ex.sets[si];
    if (s.completed) {
      setAt(si, { completed: false });
      return;
    }
    const prev = previous?.[si];
    const weight = s.weight ?? prev?.weight ?? null;
    const reps = s.reps ?? prev?.reps ?? null;
    if (!reps) {
      toast.error("Enter reps before completing the set");
      return;
    }
    const next = { ...ex, sets: ex.sets.map((x, i) => (i === si ? { ...x, weight, reps, completed: true } : x)) };
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

  const step = (si: number, field: "weight" | "reps", delta: number) => {
    const s = ex.sets[si];
    const base = s[field] ?? previous?.[si]?.[field] ?? 0;
    const next = Math.max(0, Math.round((base + delta) * 10) / 10);
    setAt(si, { [field]: next } as Partial<WorkoutSet>);
  };

  let workingNo = 0;
  const p = `${index}`;

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-surface-card/80 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] animate-fade-up"
      data-testid={`exercise-card-${p}`}
    >
      <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-xl font-bold leading-tight" data-testid={`exercise-card-name-${p}`}>
            {ex.exercise_name}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: MUSCLE_COLORS[ex.muscle_group] ?? "#94A3B8" }} />
              {ex.muscle_group}
            </span>
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
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid={`exercise-menu-button-${p}`}
            className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground active:scale-95"
            aria-label="Exercise options"
          >
            <MoreVertical className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setShowNotes(true)} data-testid={`exercise-menu-notes-${p}`}>
              <StickyNote className="size-4" /> Add note
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

      {showNotes && (
        <div className="px-4 pb-2">
          <Textarea
            value={ex.notes}
            onChange={(e) => onChange({ ...ex, notes: e.target.value })}
            placeholder="Cues, seat height, how it felt…"
            className="min-h-16 bg-background/50 text-sm"
            data-testid={`exercise-notes-input-${p}`}
          />
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[36px_1fr_1fr_56px_52px] gap-1.5 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:grid-cols-[40px_80px_1fr_1fr_68px_52px]">
        <span className="text-center">Set</span>
        <span className="hidden sm:block">Previous</span>
        <span className="text-center">kg</span>
        <span className="text-center">Reps</span>
        <span className="text-center">{ex.effort_mode}</span>
        <span className="text-center">✓</span>
      </div>

      <div className="flex flex-col gap-1.5 px-2 pb-2">
        {ex.sets.map((s, si) => {
          if (s.set_type !== "W") workingNo += 1;
          const label = s.set_type === "N" ? String(workingNo) : s.set_type;
          const prev = previous?.[si];
          const id = `${p}-${si}`;
          const effortVal = ex.effort_mode === "rpe" ? s.rpe : s.rir;
          return (
            <div key={s.uid}>
              <div
                data-testid={`set-row-${id}`}
                className={cn(
                  "grid grid-cols-[36px_1fr_1fr_56px_52px] items-center gap-1.5 rounded-xl border border-transparent px-1 py-1.5 transition-colors duration-200 sm:grid-cols-[40px_80px_1fr_1fr_68px_52px]",
                  s.completed && "border-volt/60 bg-volt/[0.12]",
                  !s.completed && si === activeIdx && "bg-surface-active/60",
                )}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    data-testid={`set-row-type-button-${id}`}
                    className={cn(
                      "grid h-12 place-items-center rounded-lg bg-background/50 font-mono text-sm font-bold transition-colors hover:bg-surface-active active:scale-95",
                      TYPE_COLOR[s.set_type],
                    )}
                    aria-label={`Set ${label} options`}
                  >
                    {label}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {(Object.keys(TYPE_LABEL) as SetType[]).map((t) => (
                      <DropdownMenuItem key={t} onClick={() => setAt(si, { set_type: t })} data-testid={`set-type-option-${t}-${id}`}>
                        <span className={cn("w-4 font-mono font-bold", TYPE_COLOR[t])}>{t}</span> {TYPE_LABEL[t]}
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

                <button
                  type="button"
                  disabled={!prev}
                  onClick={() => prev && setAt(si, { weight: prev.weight, reps: prev.reps })}
                  data-testid={`set-row-previous-${id}`}
                  className="hidden h-12 truncate rounded-md text-left font-mono text-xs text-muted-foreground transition-colors enabled:hover:text-foreground sm:block"
                  title="Tap to copy"
                >
                  {prev ? `${fmtKg(prev.weight ?? 0)} × ${prev.reps ?? 0}` : "—"}
                </button>

                <NumField
                  value={s.weight}
                  onChange={(v) => setAt(si, { weight: v })}
                  placeholder={prev?.weight != null ? fmtKg(prev.weight) : "kg"}
                  decimal
                  label="Weight in kg"
                  testid={`set-row-weight-input-${id}`}
                />
                <NumField
                  value={s.reps}
                  onChange={(v) => setAt(si, { reps: v })}
                  placeholder={prev?.reps != null ? String(prev.reps) : "reps"}
                  label="Reps"
                  testid={`set-row-reps-input-${id}`}
                />
                <select
                  value={effortVal ?? ""}
                  onChange={(e) => setEffort(si, e.target.value)}
                  data-testid={`set-row-effort-select-${id}`}
                  aria-label={ex.effort_mode.toUpperCase()}
                  className="h-12 w-full rounded-lg border border-input/70 bg-background/60 text-center font-mono text-sm font-semibold outline-none transition-[border-color] focus:border-cyan-focus"
                >
                  <option value="">–</option>
                  {(ex.effort_mode === "rpe" ? RPE_OPTIONS : RIR_OPTIONS).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => toggleComplete(si)}
                  aria-pressed={s.completed}
                  aria-label={s.completed ? "Mark set incomplete" : "Complete set"}
                  data-testid={`set-row-complete-checkbox-${id}`}
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-xl border-2 transition-[background-color,border-color,transform] duration-150 active:scale-90",
                    s.completed
                      ? "animate-set-pop border-volt bg-volt text-volt-ink shadow-[0_0_12px_rgba(34,197,94,0.4)]"
                      : "border-input bg-background/40 text-muted-foreground hover:border-volt",
                  )}
                >
                  <Check className="size-6" strokeWidth={3} />
                </button>
              </div>

              {si === activeIdx && (
                <div className="mt-1.5 grid grid-cols-4 gap-2 px-1 pb-1" data-testid={`set-stepper-${id}`}>
                  {(
                    [
                      ["weight", -2.5, "−2.5"],
                      ["weight", 2.5, "+2.5"],
                      ["reps", -1, "−1 rep"],
                      ["reps", 1, "+1 rep"],
                    ] as const
                  ).map(([field, delta, text]) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => step(si, field, delta)}
                      data-testid={`set-stepper-${field}-${delta > 0 ? "plus" : "minus"}-${id}`}
                      className="h-12 rounded-xl border border-border bg-background/40 font-mono text-xs font-semibold text-muted-foreground transition-colors hover:border-volt hover:text-foreground active:bg-surface-active active:scale-95"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...ex, sets: [...ex.sets, newSet(ex.sets[ex.sets.length - 1])] })}
        data-testid={`exercise-add-set-button-${p}`}
        className="flex h-14 w-full items-center justify-center gap-2 border-t border-border text-sm font-bold text-muted-foreground transition-colors hover:bg-surface-active hover:text-volt active:bg-surface-active"
      >
        <Plus className="size-4" /> Add set
      </button>
    </section>
  );
}
