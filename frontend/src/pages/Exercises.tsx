import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { ApiError, apiDelete, apiPost } from "@/lib/api";
import { useExercises } from "@/lib/hooks";
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type ExerciseCreate, type MuscleGroup } from "@/lib/types";
import { MUSCLE_COLORS, slug } from "@/lib/workout";
import { cn } from "@/lib/utils";

export default function Exercises() {
  const qc = useQueryClient();
  const exercises = useExercises();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mg, setMg] = useState<MuscleGroup>("Chest");
  const [eq, setEq] = useState<Equipment>("Barbell");

  const create = useMutation({
    mutationFn: (body: ExerciseCreate) => apiPost<Exercise>("/exercises", body),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      setOpen(false);
      setName("");
      toast.success(`${e.name} added to your library`);
    },
    onError: (err) => toast.error(err instanceof ApiError && err.status === 409 ? "That exercise already exists" : "Couldn't create exercise"),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/exercises/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      toast.success("Custom exercise removed");
    },
    onError: () => toast.error("Couldn't delete exercise"),
  });

  const rows = exercises.isError ? [] : exercises.data ?? [];
  const filtered = useMemo(
    () => rows.filter((e) => (!group || e.muscle_group === group) && e.name.toLowerCase().includes(q.trim().toLowerCase())),
    [rows, q, group],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of rows) c[e.muscle_group] = (c[e.muscle_group] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div>
      <PageHeader
        eyebrow={`${rows.length} movements`}
        title="Exercise library"
        testid="exercises-title"
        actions={
          <Button onClick={() => setOpen(true)} className="h-11 font-bold" data-testid="exercise-create-button">
            <Plus className="size-4" /> Custom exercise
          </Button>
        }
      />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className="h-12 pl-10" data-testid="exercise-search-input" />
      </div>
      <div className="-mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button type="button" onClick={() => setGroup(null)} data-testid="muscle-group-filter-all" className={cn("h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors", !group ? "border-volt bg-volt/15 text-volt" : "border-border text-muted-foreground hover:text-foreground")}>
          All
        </button>
        {MUSCLE_GROUPS.map((g) => (
          <button key={g} type="button" onClick={() => setGroup(group === g ? null : g)} data-testid={`muscle-group-filter-${slug(g)}`} className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors", group === g ? "border-volt bg-volt/15 text-volt" : "border-border text-muted-foreground hover:text-foreground")}>
            <span className="size-1.5 rounded-full" style={{ background: MUSCLE_COLORS[g] }} />
            {g} <span className="font-mono text-xs opacity-60">{counts[g] ?? 0}</span>
          </button>
        ))}
      </div>

      {exercises.isLoading && <div className="h-40 animate-pulse rounded-xl bg-surface" />}
      {!exercises.isLoading && filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-input p-10 text-center text-muted-foreground" data-testid="exercises-empty">
          {exercises.isError ? "Library unavailable right now." : "No matches."}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="exercise-list">
        {filtered.map((e) => (
          <div key={e.id} className="group flex min-h-[64px] items-center justify-between gap-2 rounded-xl border border-border bg-surface-card/60 px-4 py-3 transition-colors hover:border-input active:bg-surface-active" data-testid={`exercise-item-${slug(e.name)}`}>
            <div className="min-w-0">
              <p className="truncate font-semibold">{e.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ background: MUSCLE_COLORS[e.muscle_group] }} />
                {e.muscle_group} · {e.equipment}
                {e.is_custom && <span className="rounded bg-cyan-focus/15 px-1.5 text-[10px] font-semibold uppercase text-cyan-focus">Custom</span>}
              </p>
            </div>
            <div className="flex shrink-0">
              <Link to={`/analytics?exercise=${e.id}`} className="grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:text-volt active:scale-95" aria-label="View progress" data-testid={`exercise-progress-link-${slug(e.name)}`}>
                <TrendingUp className="size-4" />
              </Link>
              {e.is_custom && (
                <button type="button" onClick={() => del.mutate(e.id)} className="grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:text-crimson active:scale-95" aria-label="Delete exercise" data-testid={`exercise-delete-${slug(e.name)}`}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="exercise-create-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">Create custom exercise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ex-name">Name</Label>
              <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Landmine Press" className="h-11" data-testid="exercise-create-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Muscle group</Label>
                <Select value={mg} onValueChange={(v: string) => setMg(v as MuscleGroup)}>
                  <SelectTrigger className="h-11 w-full" data-testid="exercise-create-muscle-select"><SelectValue placeholder="Choose a muscle group" /></SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map((g) => <SelectItem key={g} value={g} data-testid={`exercise-create-muscle-option-${slug(g)}`}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Equipment</Label>
                <Select value={eq} onValueChange={(v: string) => setEq(v as Equipment)}>
                  <SelectTrigger className="h-11 w-full" data-testid="exercise-create-equipment-select"><SelectValue placeholder="Choose equipment" /></SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT.map((g) => <SelectItem key={g} value={g} data-testid={`exercise-create-equipment-option-${slug(g)}`}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name: name.trim(), muscle_group: mg, equipment: eq })} data-testid="exercise-create-submit">
              Add exercise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
