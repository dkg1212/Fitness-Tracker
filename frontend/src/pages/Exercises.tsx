import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check, ChevronDown, ChevronUp, Pencil, Plus, Search, Trash2, TrendingUp, X, Zap, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { ApiError, apiDelete, apiPost, apiPut } from "@/lib/api";
import { useExercises } from "@/lib/hooks";
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  type Equipment,
  type Exercise,
  type ExerciseCreate,
  type ExerciseUpdate,
  type MuscleGroup,
} from "@/lib/types";
import { MUSCLE_COLORS, slug } from "@/lib/workout";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// All known sub-muscle targets, grouped for the dropdown
// ─────────────────────────────────────────────────────────────────────────────

const MUSCLE_OPTIONS: { group: string; muscles: string[] }[] = [
  {
    group: "Chest",
    muscles: ["Upper Chest", "Middle Chest", "Lower Chest"],
  },
  {
    group: "Back",
    muscles: ["Lats", "Mid Back", "Upper Back", "Lower Back", "Traps"],
  },
  {
    group: "Shoulders",
    muscles: ["Front Deltoids", "Side Deltoids", "Rear Deltoids"],
  },
  {
    group: "Legs",
    muscles: ["Quadriceps", "Hamstrings", "Glutes", "Gastrocnemius", "Soleus"],
  },
  {
    group: "Arms",
    muscles: [
      "Biceps", "Biceps Long Head", "Biceps Short Head", "Brachialis", "Brachioradialis",
      "Triceps", "Triceps Long Head", "Triceps Lateral Head", "Triceps Medial Head",
    ],
  },
  {
    group: "Core",
    muscles: ["Rectus Abdominis", "Obliques", "Transverse Abdominis", "Hip Flexors"],
  },
  {
    group: "Other",
    muscles: ["External Rotators", "Serratus Anterior", "Rhomboids"],
  },
];

const ALL_MUSCLES = MUSCLE_OPTIONS.flatMap((g) => g.muscles);

// ─────────────────────────────────────────────────────────────────────────────
// Multi-select muscle dropdown
// ─────────────────────────────────────────────────────────────────────────────

function MuscleMultiSelect({
  label,
  values,
  onChange,
  accent = "volt",
  exclude = [],
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  accent?: "volt" | "cyan";
  exclude?: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = (m: string) => {
    if (values.includes(m)) onChange(values.filter((v) => v !== m));
    else onChange([...values, m]);
  };

  return (
    <div className="space-y-1.5" ref={ref}>
      <Label>{label}</Label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
          open ? "border-volt ring-2 ring-volt/30" : "border-input bg-background/60 hover:border-input/80",
        )}
      >
        {values.length === 0 ? (
          <span className="text-muted-foreground">Select muscles…</span>
        ) : (
          values.map((m) => (
            <span
              key={m}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                accent === "volt"
                  ? "bg-volt/10 text-volt"
                  : "bg-cyan-focus/10 text-cyan-focus",
              )}
            >
              {m}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); toggle(m); }}
                onKeyDown={(e) => e.key === "Enter" && toggle(m)}
                className="text-muted-foreground hover:text-crimson cursor-pointer"
                aria-label={`Remove ${m}`}
              >
                <X className="size-3" />
              </span>
            </span>
          ))
        )}
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="z-50 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl">
          {MUSCLE_OPTIONS.map(({ group, muscles }) => {
            const available = muscles.filter((m) => !exclude.includes(m));
            if (available.length === 0) return null;
            return (
              <div key={group}>
                <p className="px-3 pt-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {group}
                </p>
                {available.map((m) => {
                  const checked = values.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggle(m)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-surface-active",
                        checked && "font-semibold",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                          checked
                            ? accent === "volt"
                              ? "border-volt bg-volt text-volt-ink"
                              : "border-cyan-focus bg-cyan-focus text-background"
                            : "border-input bg-background",
                        )}
                      >
                        {checked && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      {m}
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div className="sticky bottom-0 border-t border-border bg-popover px-3 py-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-md bg-surface-active py-1.5 text-xs font-semibold hover:bg-surface-active/80"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TypeBadge
// ─────────────────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: "Compound" | "Isolation" | null }) {
  if (!type) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        type === "Compound" ? "bg-volt/15 text-volt" : "bg-cyan-focus/15 text-cyan-focus",
      )}
    >
      {type === "Compound" ? <Zap className="size-2.5" /> : <Target className="size-2.5" />}
      {type}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / Edit dialog
// ─────────────────────────────────────────────────────────────────────────────

function ExerciseFormDialog({
  open,
  onOpenChange,
  editing,
  onCreated,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Exercise | null;
  onCreated: (e: Exercise) => void;
  onUpdated: (e: Exercise) => void;
}) {
  const isEdit = !!editing;

  const [name, setName] = useState(editing?.name ?? "");
  const [mg, setMg] = useState<MuscleGroup>((editing?.muscle_group as MuscleGroup) ?? "Chest");
  const [eq, setEq] = useState<Equipment>((editing?.equipment as Equipment) ?? "Barbell");
  const [exType, setExType] = useState<"Compound" | "Isolation" | "">(editing?.exercise_type ?? "");
  const [primary, setPrimary] = useState<string[]>(editing?.primary_muscles ?? []);
  const [secondary, setSecondary] = useState<string[]>(editing?.secondary_muscles ?? []);

  const resetFor = (e: Exercise | null) => {
    setName(e?.name ?? "");
    setMg((e?.muscle_group as MuscleGroup) ?? "Chest");
    setEq((e?.equipment as Equipment) ?? "Barbell");
    setExType(e?.exercise_type ?? "");
    setPrimary(e?.primary_muscles ?? []);
    setSecondary(e?.secondary_muscles ?? []);
  };

  const createM = useMutation({
    mutationFn: (body: ExerciseCreate) => apiPost<Exercise>("/exercises", body),
    onSuccess: (e) => { onCreated(e); onOpenChange(false); },
    onError: (err) =>
      toast.error(err instanceof ApiError && err.status === 409 ? "That exercise already exists" : "Couldn't create exercise"),
  });

  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ExerciseUpdate }) =>
      apiPut<Exercise>(`/exercises/${id}`, body),
    onSuccess: (e) => { onUpdated(e); onOpenChange(false); },
    onError: (err) =>
      toast.error(err instanceof ApiError && err.status === 409 ? "That name already exists" : "Couldn't update exercise"),
  });

  const handleOpen = (o: boolean) => {
    if (o) resetFor(editing);
    onOpenChange(o);
  };

  const submit = () => {
    const payload = {
      name: name.trim(),
      muscle_group: mg,
      equipment: eq,
      exercise_type: (exType || null) as "Compound" | "Isolation" | null,
      primary_muscles: primary,
      secondary_muscles: secondary,
    };
    if (isEdit && editing) updateM.mutate({ id: editing.id, body: payload });
    else createM.mutate(payload);
  };

  const isPending = createM.isPending || updateM.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" data-testid="exercise-create-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold">
            {isEdit ? "Edit exercise" : "Create custom exercise"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="ex-name">Name</Label>
            <Input
              id="ex-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Landmine Press"
              className="h-11"
              data-testid="exercise-create-name-input"
            />
          </div>

          {/* Muscle group + Equipment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Muscle group</Label>
              <Select value={mg} onValueChange={(v) => setMg(v as MuscleGroup)}>
                <SelectTrigger className="h-11 w-full" data-testid="exercise-create-muscle-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUSCLE_GROUPS.map((g) => (
                    <SelectItem key={g} value={g} data-testid={`exercise-create-muscle-option-${slug(g)}`}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Equipment</Label>
              <Select value={eq} onValueChange={(v) => setEq(v as Equipment)}>
                <SelectTrigger className="h-11 w-full" data-testid="exercise-create-equipment-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT.map((g) => (
                    <SelectItem key={g} value={g} data-testid={`exercise-create-equipment-option-${slug(g)}`}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Exercise type toggle */}
          <div className="space-y-1.5">
            <Label>Exercise type</Label>
            <div className="flex gap-2">
              {(["Compound", "Isolation"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setExType(exType === t ? "" : t)}
                  className={cn(
                    "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors",
                    exType === t
                      ? t === "Compound"
                        ? "border-volt bg-volt/15 text-volt"
                        : "border-cyan-focus bg-cyan-focus/15 text-cyan-focus"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t === "Compound" ? <Zap className="size-3.5" /> : <Target className="size-3.5" />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Primary muscles — multi-select dropdown */}
          <MuscleMultiSelect
            label="Primary muscles targeted"
            values={primary}
            onChange={setPrimary}
            accent="volt"
            exclude={secondary}
          />

          {/* Secondary muscles — multi-select dropdown */}
          <MuscleMultiSelect
            label="Secondary muscles (assistors)"
            values={secondary}
            onChange={setSecondary}
            accent="cyan"
            exclude={primary}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!name.trim() || isPending}
            onClick={submit}
            data-testid="exercise-create-submit"
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Add exercise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single exercise card
// ─────────────────────────────────────────────────────────────────────────────

function ExerciseCard({
  e,
  onEdit,
  onDelete,
}: {
  e: Exercise;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta =
    e.exercise_type !== null ||
    (e.primary_muscles?.length ?? 0) > 0 ||
    (e.secondary_muscles?.length ?? 0) > 0;

  return (
    <div
      className="group rounded-xl border border-border bg-surface-card/60 transition-colors hover:border-input"
      data-testid={`exercise-item-${slug(e.name)}`}
    >
      {/* ── Main row ── */}
      <div className="flex items-start justify-between gap-2 px-3 py-3 sm:px-4">
        {/* Left: text content */}
        <div className="min-w-0 flex-1 pt-0.5">
          {/* Name + type badge on same line, badge wraps below if needed */}
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold leading-snug">{e.name}</p>
            <TypeBadge type={e.exercise_type ?? null} />
          </div>

          {/* Muscle / equipment row */}
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: MUSCLE_COLORS[e.muscle_group] ?? "#94A3B8" }}
            />
            <span>{e.muscle_group}</span>
            <span className="text-border">·</span>
            <span>{e.equipment}</span>
            {e.is_custom && (
              <span className="rounded bg-cyan-focus/15 px-1.5 py-px text-[10px] font-semibold uppercase text-cyan-focus">
                Custom
              </span>
            )}
          </p>

          {/* Primary muscles preview (collapsed state) */}
          {!expanded && (e.primary_muscles?.length ?? 0) > 0 && (
            <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
              <span className="text-foreground/60">Primary:</span>{" "}
              {e.primary_muscles.join(", ")}
            </p>
          )}
        </div>

        {/* Right: action buttons — compact column on mobile */}
        <div className="flex shrink-0 items-center gap-0.5">
          {hasMeta && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Collapse details" : "Expand details"}
              className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground active:scale-95 sm:size-10"
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          )}
          <Link
            to={`/analytics?exercise=${e.id}`}
            className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-active hover:text-volt active:scale-95 sm:size-10"
            aria-label="View progress"
            data-testid={`exercise-progress-link-${slug(e.name)}`}
          >
            <TrendingUp className="size-4" />
          </Link>
          {e.is_custom && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-active hover:text-cyan-focus active:scale-95 sm:size-10"
              aria-label="Edit exercise"
              data-testid={`exercise-edit-${slug(e.name)}`}
            >
              <Pencil className="size-4" />
            </button>
          )}
          {e.is_custom && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-active hover:text-crimson active:scale-95 sm:size-10"
              aria-label="Delete exercise"
              data-testid={`exercise-delete-${slug(e.name)}`}
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded detail panel ── */}
      {expanded && hasMeta && (
        <div className="border-t border-border px-3 pb-3 pt-2.5 sm:px-4">
          <div className="flex flex-wrap gap-4 text-xs">
            {(e.primary_muscles?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Primary
                </p>
                <div className="flex flex-wrap gap-1">
                  {e.primary_muscles.map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-volt/10 px-2 py-0.5 text-[11px] font-semibold text-volt"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(e.secondary_muscles?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Secondary
                </p>
                <div className="flex flex-wrap gap-1">
                  {e.secondary_muscles.map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-surface-active px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Exercises() {
  const qc = useQueryClient();
  const exercises = useExercises();

  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"Compound" | "Isolation" | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Exercise | null>(null);

  const openCreate = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = (e: Exercise) => { setEditTarget(e); setDialogOpen(true); };

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/exercises/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      toast.success("Custom exercise removed");
    },
    onError: () => toast.error("Couldn't delete exercise"),
  });

  const rows = exercises.isError ? [] : (exercises.data ?? []);

  const filtered = useMemo(
    () =>
      rows.filter(
        (e) =>
          (!group || e.muscle_group === group) &&
          (!typeFilter || e.exercise_type === typeFilter) &&
          e.name.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [rows, q, group, typeFilter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of rows) c[e.muscle_group] = (c[e.muscle_group] ?? 0) + 1;
    return c;
  }, [rows]);

  const compoundCount = useMemo(() => rows.filter((e) => e.exercise_type === "Compound").length, [rows]);
  const isolationCount = useMemo(() => rows.filter((e) => e.exercise_type === "Isolation").length, [rows]);

  return (
    <div>
      <PageHeader
        eyebrow={`${rows.length} movements`}
        title="Exercise library"
        testid="exercises-title"
        actions={
          <Button onClick={openCreate} className="h-10 px-4 text-sm font-bold sm:h-11" data-testid="exercise-create-button">
            <Plus className="size-4" /> Custom exercise
          </Button>
        }
      />

      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises…"
          className="h-11 pl-10 text-sm"
          data-testid="exercise-search-input"
        />
      </div>

      {/* Muscle group filter chips — horizontal scroll, no visible scrollbar */}
      <div className="-mx-4 mb-2.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-1.5 pb-1.5 sm:gap-2 sm:pb-2">
          <button
            type="button"
            onClick={() => setGroup(null)}
            data-testid="muscle-group-filter-all"
            className={cn(
              "h-8 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors sm:h-9 sm:px-4 sm:text-sm",
              !group ? "border-volt bg-volt/15 text-volt" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(group === g ? null : g)}
              data-testid={`muscle-group-filter-${slug(g)}`}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors sm:h-9 sm:px-4 sm:text-sm",
                group === g ? "border-volt bg-volt/15 text-volt" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: MUSCLE_COLORS[g] }} />
              {g}
              <span className="font-mono text-[10px] opacity-60 sm:text-xs">{counts[g] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Compound / Isolation filter */}
      <div className="mb-4 flex flex-wrap gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter(null)}
          className={cn(
            "h-7 rounded-full border px-3 text-[11px] font-semibold transition-colors sm:h-8 sm:text-xs",
            !typeFilter ? "border-border bg-surface-active text-foreground" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          All types
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === "Compound" ? null : "Compound")}
          className={cn(
            "flex h-7 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold transition-colors sm:h-8 sm:text-xs",
            typeFilter === "Compound" ? "border-volt bg-volt/15 text-volt" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <Zap className="size-3" /> Compound
          <span className="font-mono opacity-60">{compoundCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === "Isolation" ? null : "Isolation")}
          className={cn(
            "flex h-7 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold transition-colors sm:h-8 sm:text-xs",
            typeFilter === "Isolation" ? "border-cyan-focus bg-cyan-focus/15 text-cyan-focus" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <Target className="size-3" /> Isolation
          <span className="font-mono opacity-60">{isolationCount}</span>
        </button>
      </div>

      {exercises.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-[68px] animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      )}
      {!exercises.isLoading && filtered.length === 0 && (
        <p
          className="rounded-xl border border-dashed border-input p-10 text-center text-muted-foreground"
          data-testid="exercises-empty"
        >
          {exercises.isError ? "Library unavailable right now." : "No matches."}
        </p>
      )}

      {/* Single column on mobile, 2 on sm, 3 on lg */}
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-2 lg:grid-cols-3" data-testid="exercise-list">
        {filtered.map((e) => (
          <ExerciseCard
            key={e.id}
            e={e}
            onEdit={e.is_custom ? () => openEdit(e) : undefined}
            onDelete={e.is_custom ? () => del.mutate(e.id) : undefined}
          />
        ))}
      </div>

      <ExerciseFormDialog
        key={editTarget?.id ?? "create"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editTarget}
        onCreated={(e) => {
          qc.invalidateQueries({ queryKey: ["exercises"] });
          toast.success(`${e.name} added to your library`);
        }}
        onUpdated={(e) => {
          qc.invalidateQueries({ queryKey: ["exercises"] });
          toast.success(`${e.name} updated`);
        }}
      />
    </div>
  );
}
