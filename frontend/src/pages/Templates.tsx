import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import TemplateEditor from "@/components/TemplateEditor";
import StartWorkoutButton from "@/components/StartWorkoutButton";
import { apiDelete } from "@/lib/api";
import { useTemplates } from "@/lib/hooks";
import type { Template } from "@/lib/types";
import { fmtClock, MUSCLE_COLORS } from "@/lib/workout";

export default function Templates() {
  const qc = useQueryClient();
  const templates = useTemplates();
  const [editing, setEditing] = useState<Template | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [toDelete, setToDelete] = useState<Template | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/templates/${id}`),
    onSuccess: () => {
      for (const k of [["templates"], ["split"], ["today"]]) qc.invalidateQueries({ queryKey: k });
      setToDelete(null);
      toast.success("Template deleted");
    },
    onError: () => toast.error("Couldn't delete template"),
  });

  const openEditor = (t: Template | null) => {
    setEditing(t);
    setEditorKey((k) => k + 1);
    setEditorOpen(true);
  };

  const rows = templates.isError ? [] : templates.data ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Plan"
        title="Workout templates"
        testid="templates-title"
        actions={
          <Button onClick={() => openEditor(null)} className="h-11 font-bold" data-testid="templates-new-button">
            <Plus className="size-4" /> New template
          </Button>
        }
      />
      {templates.isLoading && <div className="h-40 animate-pulse rounded-xl bg-surface" />}
      {!templates.isLoading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-input p-10 text-center text-muted-foreground" data-testid="templates-empty">
          No templates yet. Create one, or save any workout as a template.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((t, i) => {
          const sets = t.exercises.reduce((a, e) => a + e.target_sets, 0);
          return (
            <article
              key={t.id}
              className="flex flex-col rounded-xl border border-border bg-surface-card/70 p-5 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-input animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
              data-testid={`template-card-${t.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading text-2xl font-extrabold tracking-tight">{t.name}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{t.exercises.length} exercises · {sets} sets</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" className="h-9 gap-1.5 px-2.5 text-xs" onClick={() => openEditor(t)} aria-label="Edit template" data-testid={`template-edit-${t.id}`}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button variant="ghost" className="h-9 gap-1.5 px-2.5 text-xs hover:text-crimson" onClick={() => setToDelete(t)} aria-label="Delete template" data-testid={`template-delete-${t.id}`}>
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </div>
              <ul className="mt-4 flex-1 space-y-1.5">
                {t.exercises.map((e, j) => (
                  <li key={`${e.exercise_id}-${j}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: MUSCLE_COLORS[e.muscle_group] }} />
                      <span className="truncate">{e.exercise_name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{e.target_sets}×{e.target_reps} · {fmtClock(e.rest_seconds)}</span>
                  </li>
                ))}
              </ul>
              <StartWorkoutButton body={{ template_id: t.id, name: null }} className="mt-5 h-11 w-full font-bold" testid={`template-start-${t.id}`}>
                <Play className="size-4" /> Start workout
              </StartWorkoutButton>
            </article>
          );
        })}
      </div>

      <TemplateEditor key={editorKey} open={editorOpen} onOpenChange={setEditorOpen} template={editing} />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent data-testid="template-delete-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">Delete “{toDelete?.name}”?</DialogTitle>
            <DialogDescription>Split days using this template become rest days. Past workouts are kept.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => toDelete && del.mutate(toDelete.id)} disabled={del.isPending} data-testid="template-delete-confirm">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
