/**
 * WeightInputs — split into two parts:
 *
 * 1. ExerciseConfigPanel — rendered ONCE at the top of ExerciseCard.
 *    Handles the constant parts: bar weight, body weight, BW mode, Smith bar, etc.
 *
 * 2. SetWeightField — rendered per-set row.
 *    Handles only the variable part: plates per side, stack weight,
 *    dumbbell weight, added/assistance weight, band level.
 */
import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import type { Equipment, ExerciseConfig, LoadingInputs, WorkoutSet } from "@/lib/types";
import {
  calcBarbellLoad, calcBodyweightLoad, deriveWeight, fmtKg, mergeInputs, weightNoteFor,
} from "@/lib/workout";
import { cn } from "@/lib/utils";

// ── Shared tiny numeric input ────────────────────────────────────────────────

export function NumField({
  value,
  onChange,
  placeholder,
  decimal = true,
  label,
  unit,
  testid,
  className,
  large,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  decimal?: boolean;
  label: string;
  unit?: string;
  testid?: string;
  className?: string;
  large?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value === null ? "" : String(value));

  useEffect(() => {
    if (document.activeElement !== ref.current)
      setText(value === null ? "" : String(value));
  }, [value]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
          {unit && <span className="ml-1 font-normal normal-case text-muted-foreground/60">{unit}</span>}
        </span>
      )}
      <input
        ref={ref}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        aria-label={label}
        value={text}
        placeholder={placeholder ?? "—"}
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
        className={cn(
          "w-full rounded-xl border border-input/70 bg-background/60 text-center font-mono font-semibold tabular-nums text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/40 focus:border-volt focus:ring-2 focus:ring-volt/25",
          large ? "h-14 text-xl" : "h-12 text-sm",
        )}
      />
    </div>
  );
}

// ── Exercise-level config panel (shown once at top of card) ──────────────────

/** Returns true for equipment types that need a one-time config strip. */
export function needsExerciseConfig(equipment: Equipment | null): boolean {
  if (!equipment) return false;
  return ["Barbell", "Smith Machine", "Plate-Loaded Machine", "Bodyweight"].includes(equipment);
}

type BwMode = "normal" | "weighted" | "assisted";

interface ExerciseConfigPanelProps {
  equipment: Equipment;
  config: ExerciseConfig | null;
  onChange: (cfg: ExerciseConfig) => void;
}

export function ExerciseConfigPanel({ equipment, config, onChange }: ExerciseConfigPanelProps) {
  const cfg = config ?? {};
  const patch = (p: Partial<ExerciseConfig>) => onChange({ ...cfg, ...p });

  if (equipment === "Barbell") {
    return (
      <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
        <Settings2 className="size-4 shrink-0 text-volt/70" />
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="shrink-0 text-sm font-semibold text-foreground">Bar weight</span>
          <div className="ml-auto flex items-center gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              aria-label="Bar weight kg"
              value={cfg.bar_weight == null ? "" : String(cfg.bar_weight)}
              placeholder="20"
              data-testid="config-bar-weight"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                if (!/^\d*\.?\d*$/.test(raw)) return;
                patch({ bar_weight: raw === "" ? null : parseFloat(raw) || null });
              }}
              className="h-10 w-20 rounded-lg border border-input/70 bg-background/60 text-center font-mono text-base font-bold text-foreground outline-none transition-[border-color] placeholder:text-muted-foreground/50 focus:border-volt focus:ring-2 focus:ring-volt/25"
            />
            <span className="text-sm font-medium text-muted-foreground">kg</span>
          </div>
        </div>
      </div>
    );
  }

  if (equipment === "Smith Machine") {
    const barKnown = cfg.bar_known !== false;
    return (
      <div className="mx-4 mb-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 shrink-0 text-volt/70" />
          <span className="flex-1 text-sm font-semibold text-foreground">Smith machine bar</span>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={barKnown}
              onChange={(e) => patch({ bar_known: e.target.checked, bar_weight: e.target.checked ? (cfg.bar_weight ?? null) : null })}
              className="accent-volt"
              data-testid="config-smith-known"
            />
            Known
          </label>
        </div>
        {barKnown && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Bar resistance</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label="Bar resistance kg"
              value={cfg.bar_weight == null ? "" : String(cfg.bar_weight)}
              placeholder="10"
              data-testid="config-smith-bar"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                if (!/^\d*\.?\d*$/.test(raw)) return;
                patch({ bar_weight: raw === "" ? null : parseFloat(raw) || null });
              }}
              className="ml-auto h-10 w-20 rounded-lg border border-input/70 bg-background/60 text-center font-mono text-base font-bold text-foreground outline-none transition-[border-color] placeholder:text-muted-foreground/50 focus:border-volt focus:ring-2 focus:ring-volt/25"
            />
            <span className="text-sm font-medium text-muted-foreground">kg</span>
          </div>
        )}
        {!barKnown && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">Tracking plates only — total excludes bar resistance.</p>
        )}
      </div>
    );
  }

  if (equipment === "Plate-Loaded Machine") {
    const hasResistance = cfg.bar_known !== false;
    return (
      <div className="mx-4 mb-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 shrink-0 text-volt/70" />
          <span className="flex-1 text-sm font-semibold text-foreground">Machine starting resistance</span>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={hasResistance}
              onChange={(e) => patch({ bar_known: e.target.checked, bar_weight: e.target.checked ? (cfg.bar_weight ?? null) : null })}
              className="accent-volt"
              data-testid="config-plate-machine-known"
            />
            Known
          </label>
        </div>
        {hasResistance && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Starting resistance</span>
            <input
              type="text"
              inputMode="decimal"
              aria-label="Starting resistance kg"
              value={cfg.bar_weight == null ? "" : String(cfg.bar_weight)}
              placeholder="0"
              data-testid="config-plate-machine-bar"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                if (!/^\d*\.?\d*$/.test(raw)) return;
                patch({ bar_weight: raw === "" ? null : parseFloat(raw) || null });
              }}
              className="ml-auto h-10 w-20 rounded-lg border border-input/70 bg-background/60 text-center font-mono text-base font-bold text-foreground outline-none transition-[border-color] placeholder:text-muted-foreground/50 focus:border-volt focus:ring-2 focus:ring-volt/25"
            />
            <span className="text-sm font-medium text-muted-foreground">kg</span>
          </div>
        )}
      </div>
    );
  }

  if (equipment === "Bodyweight") {
    const mode: BwMode = (cfg.bw_mode as BwMode) ?? "normal";
    return (
      <div className="mx-4 mb-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
        <div className="mb-3 flex items-center gap-2">
          <Settings2 className="size-4 shrink-0 text-volt/70" />
          <span className="text-sm font-semibold text-foreground">Bodyweight settings</span>
        </div>
        {/* Mode selector */}
        <div className="mb-3 flex gap-1 rounded-xl bg-muted/40 p-1">
          {(["normal", "weighted", "assisted"] as BwMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => patch({ bw_mode: m })}
              data-testid={`config-bw-mode-${m}`}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors capitalize",
                mode === m
                  ? "bg-volt text-volt-ink shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        {/* Bodyweight */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">Your bodyweight</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Bodyweight kg"
            value={cfg.bodyweight == null ? "" : String(cfg.bodyweight)}
            placeholder="70"
            data-testid="config-bodyweight"
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const raw = e.target.value.replace(",", ".");
              if (!/^\d*\.?\d*$/.test(raw)) return;
              patch({ bodyweight: raw === "" ? null : parseFloat(raw) || null });
            }}
            className="ml-auto h-10 w-20 rounded-lg border border-input/70 bg-background/60 text-center font-mono text-base font-bold text-foreground outline-none transition-[border-color] placeholder:text-muted-foreground/50 focus:border-volt focus:ring-2 focus:ring-volt/25"
          />
          <span className="text-sm font-medium text-muted-foreground">kg</span>
        </div>
      </div>
    );
  }

  return null;
}

// ── Per-set weight field ─────────────────────────────────────────────────────

/**
 * SetWeightField — inline per-set weight input.
 * Only handles the VARIABLE part per set.
 * Config (bar weight, body weight) is passed in from the exercise level.
 */
interface SetWeightFieldProps {
  equipment: Equipment | null;
  config: ExerciseConfig | null | undefined;
  set: WorkoutSet;
  prevSet?: WorkoutSet;
  onChange: (patch: Partial<WorkoutSet>) => void;
}

/** Label for the weight column shown in the header */
export function weightColLabel(equipment: Equipment | null): string {
  if (!equipment) return "kg";
  const map: Partial<Record<Equipment, string>> = {
    Barbell: "plates/side",
    "Smith Machine": "plates/side",
    "Plate-Loaded Machine": "plates/side",
    Dumbbell: "kg/hand",
    Kettlebell: "kg",
    Cable: "stack",
    Machine: "stack",
    Bodyweight: "+/− kg",
    "Resistance Band": "band",
  };
  return map[equipment] ?? "kg";
}

export default function SetWeightField({ equipment, config, set, prevSet, onChange }: SetWeightFieldProps) {
  const inputs: LoadingInputs = set.loading_inputs ?? {};

  const commit = (patch: Partial<LoadingInputs>) => {
    const nextInputs: LoadingInputs = { ...inputs, ...patch };
    // Merge config (bar weight, body weight) + set inputs to derive total
    const merged = mergeInputs(config, nextInputs);
    const derived = deriveWeight(merged, equipment);
    const note = weightNoteFor(equipment);
    onChange({
      loading_inputs: nextInputs,
      weight: derived,
      weight_note: note || null,
    });
  };

  // ── Plain kg (no equipment, legacy, Dumbbell, Kettlebell, Cable, Machine) ──
  // These are simple single-field — just show a plain numeric input inline
  if (
    !equipment ||
    equipment === "Dumbbell" ||
    equipment === "Kettlebell" ||
    equipment === "Cable" ||
    equipment === "Machine"
  ) {
    // For Dumbbell/Kettlebell the value IS the weight; for Cable/Machine it's stack weight
    const val = equipment === "Dumbbell" || equipment === "Kettlebell"
      ? inputs.per_dumbbell ?? null
      : equipment === "Cable" || equipment === "Machine"
      ? inputs.stack_weight ?? null
      : set.weight;

    const prevVal = equipment === "Dumbbell" || equipment === "Kettlebell"
      ? prevSet?.loading_inputs?.per_dumbbell ?? prevSet?.weight ?? null
      : equipment === "Cable" || equipment === "Machine"
      ? prevSet?.loading_inputs?.stack_weight ?? prevSet?.weight ?? null
      : prevSet?.weight ?? null;

    const handleChange = (v: number | null) => {
      if (equipment === "Dumbbell" || equipment === "Kettlebell") {
        const note = weightNoteFor(equipment);
        onChange({ loading_inputs: { ...inputs, per_dumbbell: v }, weight: v, weight_note: note || null });
      } else if (equipment === "Cable" || equipment === "Machine") {
        onChange({ loading_inputs: { ...inputs, stack_weight: v }, weight: v, weight_note: weightNoteFor(equipment) || null });
      } else {
        onChange({ weight: v, loading_inputs: null });
      }
    };

    return (
      <InlineNumInput
        value={val}
        onChange={handleChange}
        placeholder={prevVal != null ? fmtKg(prevVal) : "—"}
        label={equipment ? weightColLabel(equipment) : "kg"}
        testid="set-weight-simple"
      />
    );
  }

  // ── Barbell / Smith Machine / Plate-Loaded Machine ───────────────────────
  if (
    equipment === "Barbell" ||
    equipment === "Smith Machine" ||
    equipment === "Plate-Loaded Machine"
  ) {
    const perSide = inputs.plates_per_side ?? null;
    const prevPerSide = prevSet?.loading_inputs?.plates_per_side ?? null;

    // Calculate total using merged config + this set's plates
    const merged = mergeInputs(config, { ...inputs });
    const total = calcBarbellLoad(merged);

    return (
      <div className="flex flex-col items-center gap-0.5 w-full">
        <InlineNumInput
          value={perSide}
          onChange={(v) => commit({ plates_per_side: v, total_plates: null })}
          placeholder={prevPerSide != null ? fmtKg(prevPerSide) : "0"}
          label="plates/side"
          testid="set-weight-plates-side"
        />
        {total !== null && (
          <span className="text-[9px] font-semibold text-volt leading-none">{fmtKg(total)} total</span>
        )}
      </div>
    );
  }

  // ── Bodyweight ────────────────────────────────────────────────────────────
  if (equipment === "Bodyweight") {
    const mode: BwMode = (config?.bw_mode as BwMode) ?? "normal";
    const bw = config?.bodyweight ?? null;

    if (mode === "normal") {
      // No variable part — just show BW
      const effective = bw !== null ? bw : null;
      return (
        <div className="flex flex-col items-center gap-0.5">
          {effective !== null ? (
            <>
              <span className="font-mono text-sm font-bold text-foreground">{fmtKg(effective)}</span>
              <span className="text-[9px] text-muted-foreground">bodyweight</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">BW</span>
          )}
        </div>
      );
    }

    if (mode === "weighted") {
      const added = inputs.added_weight ?? null;
      const prevAdded = prevSet?.loading_inputs?.added_weight ?? null;
      const merged = mergeInputs(config, inputs);
      const total = calcBodyweightLoad(merged);
      return (
        <div className="flex flex-col items-center gap-0.5 w-full">
          <InlineNumInput
            value={added}
            onChange={(v) => commit({ added_weight: v })}
            placeholder={prevAdded != null ? fmtKg(prevAdded) : "+0"}
            label="+kg"
            testid="set-weight-added"
          />
          {total !== null && (
            <span className="text-[9px] font-semibold text-volt leading-none">{fmtKg(total)} total</span>
          )}
        </div>
      );
    }

    if (mode === "assisted") {
      const assist = inputs.assistance_weight ?? null;
      const prevAssist = prevSet?.loading_inputs?.assistance_weight ?? null;
      const merged = mergeInputs(config, inputs);
      const total = calcBodyweightLoad(merged);
      return (
        <div className="flex flex-col items-center gap-0.5 w-full">
          <InlineNumInput
            value={assist}
            onChange={(v) => commit({ assistance_weight: v })}
            placeholder={prevAssist != null ? fmtKg(prevAssist) : "0"}
            label="assist"
            testid="set-weight-assist"
          />
          {total !== null && (
            <span className="text-[9px] font-semibold text-volt leading-none">{fmtKg(total)} eff.</span>
          )}
        </div>
      );
    }
  }

  // ── Resistance Band ───────────────────────────────────────────────────────
  if (equipment === "Resistance Band") {
    const bandKg = inputs.band_resistance ?? null;
    const bandLevel = inputs.band_level ?? "";
    return (
      <div className="flex flex-col gap-1 w-full">
        <InlineNumInput
          value={bandKg}
          onChange={(v) => commit({ band_resistance: v })}
          placeholder="kg?"
          label="band"
          testid="set-weight-band-kg"
        />
        {!bandKg && (
          <input
            type="text"
            value={bandLevel}
            onChange={(e) => commit({ band_level: e.target.value || null })}
            placeholder="Light…"
            data-testid="set-weight-band-level"
            className="h-7 w-full rounded-md border border-input/50 bg-background/50 px-2 text-center text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-volt"
          />
        )}
      </div>
    );
  }

  // Fallback
  return (
    <InlineNumInput
      value={set.weight}
      onChange={(v) => onChange({ weight: v })}
      placeholder="kg"
      label="kg"
      testid="set-weight-fallback"
    />
  );
}

// ── Shared inline number input (no label above, compact for set rows) ────────
function InlineNumInput({
  value,
  onChange,
  placeholder,
  label,
  testid,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  label: string;
  testid?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => {
    if (document.activeElement !== ref.current)
      setText(value === null ? "" : String(value));
  }, [value]);
  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={text}
      placeholder={placeholder ?? "—"}
      data-testid={testid}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => setText(value === null ? "" : String(value))}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        if (raw === "" || raw === ".") onChange(null);
        else {
          const n = parseFloat(raw);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
      className="h-12 w-full min-w-0 rounded-xl border border-input/70 bg-background/60 text-center font-mono text-base font-semibold tabular-nums text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/40 focus:border-volt focus:ring-2 focus:ring-volt/25"
    />
  );
}

/** Build default exercise config for a given equipment type. */
export function defaultExerciseConfig(equipment: Equipment | null): ExerciseConfig | null {
  if (!equipment) return null;
  switch (equipment) {
    case "Barbell": return { bar_weight: 20 };
    case "Smith Machine": return { bar_known: true, bar_weight: null };
    case "Plate-Loaded Machine": return { bar_known: false, bar_weight: null };
    case "Bodyweight": return { bw_mode: "normal", bodyweight: null };
    default: return null;
  }
}
