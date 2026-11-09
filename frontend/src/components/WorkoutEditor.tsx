import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CloudOff, CloudUpload, Check, AlertTriangle, MoreHorizontal, Plus, Save, Trash2, Trophy, Flag, History as HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ExerciseCard from "@/components/ExerciseCard";
import ExercisePicker from "@/components/ExercisePicker";
import RestTimer from "@/components/RestTimer";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { FinishResult, PreviousSets, Template, TemplateIn, Workout, WorkoutExercise } from "@/lib/types";
import { clearLocalDraft, useAutosaveWorkout, type SyncState } from "@/lib/useAutosaveWorkout";
import { useRestTimer } from "@/lib/useRestTimer";
import { draftStats, fmtClock, fmtKg, fmtVolume, newWorkoutExercise, toUpdate } from "@/lib/workout";
import { cn } from "@/lib/utils";

const SYNC_META: Record<SyncState, { label: string; icon: typeof Check; cls: string }> = {
  saved: { label: "Saved", icon: Check, cls: "text-volt border-volt/40" },
  pending: { label: "Unsaved", icon: CloudUpload, cls: "text-muted-foreground border-border" },
  saving: { label: "Saving…", icon: CloudUpload, cls: "text-cyan-focus border-cyan-focus/40" },
  offline: { label: "Offline · stored locally", icon: CloudOff, cls: "text-amber-warn border-amber-warn/50" },
  error: { label: "Retrying…", icon: AlertTriangle, cls: "text-crimson border-crimson/50" },
};

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <>{fmtClock((now - new Date(since).getTime()) / 1000)}</>;
}

export default function WorkoutEditor({ initial }: { initial: Workout }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { draft, update, sync, restored, flush } = useAutosaveWorkout(initial);
  const { rest, start: startRest, adjust, skip } = useRestTimer();
  const isEdit = draft.status === "completed";

  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [result, setResult] = useState<FinishResult | null>(null);

  const ids = useMemo(() => [...new Set(draft.exercises.map((e) => e.exercise_id))].sort().join(","), [draft.exercises]);
  const prevQ = useQuery({
    queryKey: ["previous", ids, draft.id],
    queryFn: () => apiGet<PreviousSets>(`/workouts/previous?exercise_ids=${encodeURIComponent(ids)}&exclude=${draft.id}`),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });

  const stats = draftStats(draft);

  const setExercise = (i: number, ex: WorkoutExercise) =>
    update((w) => ({ ...w, exercises: w.exercises.map((e, j) => (j === i ? ex : e)) }));

  const moveExercise = (i: number, dir: -1 | 1) =>
    update((w) => {
      const list = [...w.exercises];
      const j = i + dir;
      if (j < 0 || j >= list.length) return w;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...w, exercises: list };
    });

  const invalidateAll = () => {
    for (const key of [["workouts"], ["analytics"], ["today"], ["previous"]]) qc.invalidateQueries({ queryKey: key });
  };

  const finishM = useMutation({
    mutationFn: () => apiPost<FinishResult>(`/workouts/${draft.id}/finish`, toUpdate(draft)),
    onSuccess: (r) => {
      clearLocalDraft(draft.id);
      skip();
      setFinishOpen(false);
      setResult(r);
      invalidateAll();
    },
    onError: () => toast.error("Couldn't finish — your workout is saved locally. Try again when online."),
  });

  const discardM = useMutation({
    mutationFn: () => apiDelete<void>(`/workouts/${draft.id}`),
    onSuccess: () => {
      clearLocalDraft(draft.id);
      skip();
      invalidateAll();
      qc.setQueryData(["workout", "active"], null);
      toast.success(isEdit ? "Workout deleted" : "Workout discarded");
      navigate(isEdit ? "/history" : "/");
    },
    onError: () => toast.error("Couldn't delete workout"),
  });

  const templateM = useMutation({
    mutationFn: (body: TemplateIn) => apiPost<Template>("/templates", body),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setTemplateOpen(false);
      toast.success(`Template “${t.name}” saved`);
    },
    onError: () => toast.error("Couldn't save template"),
  });

  const saveAsTemplate = () => {
    const body: TemplateIn = {
      name: templateName.trim() || draft.name,
      notes: "",
      exercises: draft.exercises.map((e) => {
        const working = e.sets.filter((s) => s.set_type !== "W");
        const firstReps = working.find((s) => s.reps)?.reps;
        return {
          exercise_id: e.exercise_id,
          exercise_name: e.exercise_name,
          muscle_group: e.muscle_group,
          target_sets: Math.min(10, Math.max(1, working.length || e.sets.length || 3)),
          target_reps: firstReps ? String(firstReps) : "8-12",
          rest_seconds: e.rest_seconds,
        };
      }),
    };
    templateM.mutate(body);
  };

  const doneEditing = async () => {
    await flush();
    invalidateAll();
    qc.invalidateQueries({ queryKey: ["workout", draft.id] });
    clearLocalDraft(draft.id);
    toast.success("Workout updated");
    navigate("/history");
  };

  const closeResult = () => {
    setResult(null);
    navigate("/history");
    qc.setQueryData(["workout", "active"], null);
  };

  const meta = SYNC_META[sync];
  const SyncIcon = meta.icon;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Sticky session header */}
      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:rounded-xl lg:border lg:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-volt">
                {isEdit ? "Editing" : "Live"}
              </span>
              <span
                data-testid="autosave-status"
                className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", meta.cls)}
              >
                <SyncIcon className="size-3" /> {meta.label}
              </span>
            </div>
            <input
              value={draft.name}
              onChange={(e) => update((w) => ({ ...w, name: e.target.value }))}
              data-testid="workout-name-input"
              aria-label="Workout name"
              className="mt-0.5 w-full bg-transparent font-heading text-2xl font-extrabold tracking-tight outline-none focus:text-volt"
            />
          </div>
          <div className="flex items-center gap-2">
            {isEdit ? (
              <Button onClick={() => void doneEditing()} className="h-12 px-5 text-base font-bold" data-testid="edit-done-button">
                <Check className="size-4" /> Done
              </Button>
            ) : (
              <Button onClick={() => setFinishOpen(true)} className="h-12 px-5 text-base font-bold" data-testid="finish-workout-button">
                <Flag className="size-4" /> Finish
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid="workout-menu-button"
                aria-label="Workout options"
                className="grid size-12 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground active:bg-surface-active"
              >
                <MoreHorizontal className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => {
                    setTemplateName(draft.name);
                    setTemplateOpen(true);
                  }}
                  data-testid="workout-menu-save-template"
                >
                  <Save className="size-4" /> Save as template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDiscardOpen(true)} data-testid="workout-menu-discard">
                  <Trash2 className="size-4" /> {isEdit ? "Delete workout" : "Discard workout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{isEdit ? "Date" : "Duration"}</span>
            {isEdit ? (
              <input
                type="date"
                value={draft.date}
                onChange={(e) => e.target.value && update((w) => ({ ...w, date: e.target.value }))}
                data-testid="workout-date-input"
                className="bg-transparent font-semibold text-foreground outline-none [color-scheme:dark]"
              />
            ) : (
              <span className="text-base font-semibold tabular-nums" data-testid="workout-elapsed">
                <Elapsed since={draft.started_at} />
              </span>
            )}
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Volume</span>
            <span className="text-base font-semibold tabular-nums" data-testid="workout-volume">{fmtVolume(stats.volume)} kg</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Sets</span>
            <span className="text-base font-semibold tabular-nums" data-testid="workout-sets-count">{stats.sets}/{stats.total}</span>
          </div>
        </div>
      </div>

      {restored && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-warn/40 bg-amber-warn/10 p-3 text-sm" data-testid="restored-draft-banner">
          <HistoryIcon className="mt-0.5 size-4 shrink-0 text-amber-warn" />
          <p>Restored unsynced changes from this device. They're being saved to the server{sync === "offline" ? " when you're back online" : ""}.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {draft.exercises.length === 0 && (
          <div className="rounded-xl border border-dashed border-input p-10 text-center" data-testid="workout-empty-state">
            <p className="font-heading text-xl font-bold">Empty session</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first exercise to start logging sets.</p>
          </div>
        )}
        {draft.exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.uid}
            ex={ex}
            index={i}
            previous={prevQ.data?.[ex.exercise_id]}
            isFirst={i === 0}
            isLast={i === draft.exercises.length - 1}
            onChange={(next) => setExercise(i, next)}
            onRemove={() => update((w) => ({ ...w, exercises: w.exercises.filter((_, j) => j !== i) }))}
            onMove={(dir) => moveExercise(i, dir)}
            onSetCompleted={(e) => !isEdit && startRest(e.rest_seconds, e.exercise_name)}
          />
        ))}

        <Button
          variant="outline"
          onClick={() => setPickerOpen(true)}
          className="h-16 border-dashed text-base font-bold hover:border-volt hover:text-volt active:scale-[0.98]"
          data-testid="active-workout-add-exercise-button"
        >
          <Plus className="size-5" /> Add exercise
        </Button>

        <div>
          <label htmlFor="workout-notes" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Workout notes
          </label>
          <Textarea
            id="workout-notes"
            value={draft.notes}
            onChange={(e) => update((w) => ({ ...w, notes: e.target.value }))}
            placeholder="Sleep, energy, anything worth remembering…"
            className="min-h-20 bg-surface/60"
            data-testid="workout-notes-input"
          />
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(e) => update((w) => ({ ...w, exercises: [...w.exercises, newWorkoutExercise(e)] }))}
      />

      <RestTimer rest={rest} onAdjust={adjust} onSkip={skip} />

      {/* Finish confirm */}
      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent data-testid="finish-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">Finish workout?</DialogTitle>
            <DialogDescription>
              {stats.sets} working sets · {fmtVolume(stats.volume)} kg volume.
              {stats.total > stats.sets ? " Sets you didn't tick off will be discarded." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinishOpen(false)} data-testid="finish-cancel-button">Keep training</Button>
            <Button onClick={() => finishM.mutate()} disabled={finishM.isPending} data-testid="finish-confirm-button">
              {finishM.isPending ? "Saving…" : "Finish & save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result */}
      <Dialog open={!!result} onOpenChange={(o) => !o && closeResult()}>
        <DialogContent data-testid="finish-result-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-extrabold">Session logged</DialogTitle>
            <DialogDescription>Nice work. Here's the damage.</DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Duration", `${result.duration_min} min`, "result-duration"],
                  ["Volume", `${fmtVolume(result.volume)} kg`, "result-volume"],
                  ["Sets", String(result.completed_sets), "result-sets"],
                ].map(([k, v, t]) => (
                  <div key={k} className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                    <p className="font-mono text-lg font-bold" data-testid={t}>{v}</p>
                  </div>
                ))}
              </div>
              {result.new_prs.length > 0 ? (
                <div className="space-y-2" data-testid="result-pr-list">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-warn"><Trophy className="size-4" /> New personal records</p>
                  {result.new_prs.map((pr) => (
                    <div key={`${pr.exercise_id}-${pr.kind}`} className="flex items-center justify-between rounded-md border border-amber-warn/30 bg-amber-warn/10 px-3 py-2 text-sm">
                      <span className="font-semibold">{pr.exercise_name}</span>
                      <span className="font-mono">
                        {pr.kind === "weight" ? `${fmtKg(pr.weight)} kg × ${pr.reps}` : `e1RM ${fmtKg(pr.value)} kg`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="result-no-prs">No new PRs this time — consistency builds them.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={closeResult} className="w-full" data-testid="finish-result-done-button">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard / delete */}
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent data-testid="discard-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">{isEdit ? "Delete this workout?" : "Discard this workout?"}</DialogTitle>
            <DialogDescription>This can't be undone. All logged sets in this session will be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)} data-testid="discard-cancel-button">Cancel</Button>
            <Button variant="destructive" onClick={() => discardM.mutate()} disabled={discardM.isPending} data-testid="discard-confirm-button">
              {isEdit ? "Delete" : "Discard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as template */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent data-testid="save-template-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">Save as template</DialogTitle>
            <DialogDescription>Reuse these exercises, set counts and rest times next time.</DialogDescription>
          </DialogHeader>
          <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="h-11" data-testid="save-template-name-input" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancel</Button>
            <Button onClick={saveAsTemplate} disabled={templateM.isPending || draft.exercises.length === 0} data-testid="save-template-button">
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
