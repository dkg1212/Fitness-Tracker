import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ExercisePicker from "@/components/ExercisePicker";
import { apiPost, apiPut } from "@/lib/api";
import type { Template, TemplateExercise, TemplateIn } from "@/lib/types";
import { MUSCLE_COLORS } from "@/lib/workout";

export default function TemplateEditor({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: Template | null;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(template?.name ?? "");
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [items, setItems] = useState<TemplateExercise[]>(template?.exercises ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const save = useMutation({
    mutationFn: (body: TemplateIn) =>
      template ? apiPut<Template>(`/templates/${template.id}`, body) : apiPost<Template>("/templates", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["split"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      toast.success(template ? "Template updated" : "Template created");
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn't save template"),
  });

  const patch = (i: number, p: Partial<TemplateExercise>) =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, ...p } : it)));
  const move = (i: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const j = i + dir;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-xl" data-testid="template-editor-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold">{template ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push A" className="h-11" data-testid="template-name-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-notes">Notes</Label>
            <Textarea id="tpl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="min-h-14" data-testid="template-notes-input" />
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_56px_72px_64px_28px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Exercise</span><span className="text-center">Sets</span><span className="text-center">Reps</span><span className="text-center">Rest s</span><span />
            </div>
            {items.length === 0 && (
              <p className="rounded-md border border-dashed border-input p-4 text-center text-sm text-muted-foreground" data-testid="template-empty">
                No exercises yet.
              </p>
            )}
            {items.map((it, i) => (
              <div key={`${it.exercise_id}-${i}`} className="grid grid-cols-[1fr_56px_72px_64px_28px] items-center gap-2 rounded-md bg-surface p-1.5" data-testid={`template-item-${i}`}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <div className="flex flex-col">
                    <button type="button" onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground" aria-label="Move up" data-testid={`template-item-up-${i}`}><ArrowUp className="size-3.5" /></button>
                    <button type="button" onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground" aria-label="Move down" data-testid={`template-item-down-${i}`}><ArrowDown className="size-3.5" /></button>
                  </div>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: MUSCLE_COLORS[it.muscle_group] }} />
                  <span className="truncate text-sm font-semibold">{it.exercise_name}</span>
                </div>
                <Input type="number" min={1} max={10} value={it.target_sets} onChange={(e) => patch(i, { target_sets: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} className="h-10 text-center font-mono" data-testid={`template-item-sets-${i}`} />
                <Input value={it.target_reps} onChange={(e) => patch(i, { target_reps: e.target.value.slice(0, 20) })} className="h-10 text-center font-mono" data-testid={`template-item-reps-${i}`} />
                <Input type="number" min={0} max={900} step={15} value={it.rest_seconds} onChange={(e) => patch(i, { rest_seconds: Math.min(900, Math.max(0, Number(e.target.value) || 0)) })} className="h-10 text-center font-mono" data-testid={`template-item-rest-${i}`} />
                <button type="button" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} className="grid size-7 place-items-center text-muted-foreground hover:text-crimson" aria-label="Remove" data-testid={`template-item-remove-${i}`}>
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" onClick={() => setPickerOpen(true)} className="h-11 w-full border-dashed" data-testid="template-add-exercise-button">
              <Plus className="size-4" /> Add exercise
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="template-cancel-button">Cancel</Button>
          <Button
            disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate({ name: name.trim(), notes, exercises: items })}
            data-testid="template-save-button"
          >
            {save.isPending ? "Saving…" : "Save template"}
          </Button>
        </DialogFooter>
        <ExercisePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onPick={(e) =>
            setItems((l) => [
              ...l,
              { exercise_id: e.id, exercise_name: e.name, muscle_group: e.muscle_group, target_sets: 3, target_reps: "8-12", rest_seconds: 120 },
            ])
          }
        />
      </DialogContent>
    </Dialog>
  );
}
