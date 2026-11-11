import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
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

      {/* Empty state card */}
      <div className="rounded-2xl border border-border bg-surface-card/70 p-5 sm:p-6 animate-fade-up">
        <Dumbbell className="size-8 text-volt sm:size-9" />
        <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-base">
          No session in progress. Start from a template or log freestyle.
        </p>
        <StartWorkoutButton
          body={{ template_id: null, name: null }}
          className="mt-4 h-11 w-full px-5 text-sm font-bold sm:mt-5 sm:h-12 sm:w-auto sm:px-6"
          testid="logger-start-empty-button"
        >
          <Plus className="size-4" /> Start empty workout
        </StartWorkoutButton>
      </div>

      {/* Template cards */}
      {!templates.isError && (templates.data?.length ?? 0) > 0 && (
        <div className="mt-5 sm:mt-6">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Start from template
          </h3>
          {/* Single column on mobile, two columns on sm+ */}
          <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2 sm:gap-3">
            {templates.data?.map((t) => (
              <StartWorkoutButton
                key={t.id}
                body={{ template_id: t.id, name: null }}
                variant="card"
                testid={`logger-start-template-${t.id}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-base font-bold text-foreground sm:text-lg">
                    {t.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t.exercises.length} exercise{t.exercises.length !== 1 ? "s" : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="hidden text-xs font-semibold text-volt sm:inline">Start</span>
                  <Play className="size-5 text-volt" />
                </span>
              </StartWorkoutButton>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton for templates */}
      {templates.isLoading && (
        <div className="mt-5 sm:mt-6">
          <div className="mb-3 h-3 w-32 animate-pulse rounded bg-surface-active" />
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((n) => (
              <div key={n} className="h-16 animate-pulse rounded-2xl bg-surface-card" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Logger() {
  const { id } = useParams();
  const { userId } = useAuth();
  const activeQ = useActiveWorkout();
  const byIdQ = useQuery({
    queryKey: ["workout", id],
    queryFn: () => apiGet<Workout>(`/workouts/${id}`),
    enabled: !!id,
  });
  const q = id ? byIdQ : activeQ;

  const unreachable = q.isError || q.fetchStatus === "paused";
  if (unreachable) {
    const local = readLocalDraft(id, userId);
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
