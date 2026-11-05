import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell, Play, Plus, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import WorkoutEditor from "@/components/WorkoutEditor";
import StartWorkoutButton from "@/components/StartWorkoutButton";
import { apiGet } from "@/lib/api";
import { useActiveWorkout, useTemplates } from "@/lib/hooks";
import type { Workout } from "@/lib/types";
import { readLocalDraft } from "@/lib/useAutosaveWorkout";

function NoActive() {
  const templates = useTemplates();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Train" title="Ready when you are" testid="logger-empty-title" />
      <div className="rounded-2xl border border-border bg-surface-card/70 p-6 animate-fade-up">
        <Dumbbell className="size-8 text-volt" />
        <p className="mt-3 text-muted-foreground">No session in progress. Start from a template or log freestyle.</p>
        <StartWorkoutButton body={{ template_id: null, name: null }} className="mt-5 h-12 px-6 text-base font-bold" testid="logger-start-empty-button">
          <Plus className="size-4" /> Start empty workout
        </StartWorkoutButton>
      </div>
      {!templates.isError && (templates.data?.length ?? 0) > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">Start from template</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.data?.map((t) => (
              <StartWorkoutButton key={t.id} body={{ template_id: t.id, name: null }} className="flex min-h-16 w-full items-center justify-between rounded-xl border border-border bg-surface/70 px-4 py-3 text-left transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-volt" testid={`logger-start-template-${t.id}`}>
                <span>
                  <span className="block font-heading font-bold">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.exercises.length} exercises</span>
                </span>
                <Play className="size-4 text-volt" />
              </StartWorkoutButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Logger() {
  const { id } = useParams();
  const activeQ = useActiveWorkout();
  const byIdQ = useQuery({
    queryKey: ["workout", id],
    queryFn: () => apiGet<Workout>(`/workouts/${id}`),
    enabled: !!id,
  });
  const q = id ? byIdQ : activeQ;

  const unreachable = q.isError || q.fetchStatus === "paused";
  if (unreachable) {
    const local = readLocalDraft(id);
    if (local) return <WorkoutEditor key={local.id} initial={local} />;
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-surface p-8 text-center" data-testid="logger-unreachable">
        <WifiOff className="mx-auto size-8 text-amber-warn" />
        <p className="mt-3 font-heading text-xl font-bold">Can't reach the server</p>
        <p className="mt-1 text-sm text-muted-foreground">No locally saved session on this device. Reconnect to load your workout.</p>
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="logger-loading">
        <div className="h-24 animate-pulse rounded-xl bg-surface" />
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }

  if (!q.data) return <NoActive />;
  return <WorkoutEditor key={q.data.id} initial={q.data} />;
}
