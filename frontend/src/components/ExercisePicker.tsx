import { useMemo, useState } from "react";
import { Search, Zap, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useExercises } from "@/lib/hooks";
import { MUSCLE_GROUPS, type Exercise } from "@/lib/types";
import { MUSCLE_COLORS, slug } from "@/lib/workout";
import { cn } from "@/lib/utils";

export default function ExercisePicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (ex: Exercise) => void;
}) {
  const { data = [], isLoading } = useExercises();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      data.filter(
        (e) => (!group || e.muscle_group === group) && e.name.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [data, q, group],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-3 sm:max-w-lg" data-testid="exercise-picker-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold">Add exercise</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 60+ exercises"
            className="h-11 pl-9"
            data-testid="exercise-picker-search-input"
          />
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => setGroup(null)}
            data-testid="exercise-picker-filter-all"
            className={cn("h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors", !group ? "border-volt bg-volt/15 text-volt" : "border-border text-muted-foreground")}
          >
            All
          </button>
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(group === g ? null : g)}
              data-testid={`exercise-picker-filter-${slug(g)}`}
              className={cn("h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors", group === g ? "border-volt bg-volt/15 text-volt" : "border-border text-muted-foreground")}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2" data-testid="exercise-picker-list">
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading library…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground" data-testid="exercise-picker-empty">
              No exercises match. Create a custom one in the Exercise Library.
            </p>
          )}
          {filtered.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                onPick(e);
                onOpenChange(false);
                setQ("");
              }}
              data-testid={`exercise-picker-option-${slug(e.name)}`}
              className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-surface-active active:bg-surface-active active:scale-[0.98]"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="block text-base font-semibold">{e.name}</span>
                  {e.exercise_type && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        e.exercise_type === "Compound"
                          ? "bg-volt/15 text-volt"
                          : "bg-cyan-focus/15 text-cyan-focus",
                      )}
                    >
                      {e.exercise_type === "Compound" ? (
                        <Zap className="size-2.5" />
                      ) : (
                        <Target className="size-2.5" />
                      )}
                      {e.exercise_type}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {e.equipment}
                  {e.is_custom ? " · Custom" : ""}
                  {(e.primary_muscles?.length ?? 0) > 0 && (
                    <> · {e.primary_muscles.slice(0, 2).join(", ")}</>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: MUSCLE_COLORS[e.muscle_group] }} />
                {e.muscle_group}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
