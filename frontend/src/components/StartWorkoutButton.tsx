import { useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStartWorkout } from "@/lib/hooks";
import type { WorkoutStart } from "@/lib/types";

type Props = {
  body: WorkoutStart;
  children: ReactNode;
  className?: string;
  variant?: string;
  testid: string;
};

/** A deliberate start action prevents accidental empty workout sessions. */
export default function StartWorkoutButton({ body, children, className, variant, testid }: Props) {
  const [open, setOpen] = useState(false);
  const start = useStartWorkout();
  const isTemplate = !!body.template_id;

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)} disabled={start.isPending} data-testid={testid}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="start-workout-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-extrabold">Start workout?</DialogTitle>
            <DialogDescription className="text-base">
              {isTemplate ? "Your template will be loaded and a new training session will begin." : "A new empty training session will begin. You can add exercises after it starts."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Not now</Button>
            <Button onClick={() => start.mutate(body)} disabled={start.isPending} data-testid="start-workout-confirm">
              <Play className="size-4" /> {start.isPending ? "Starting…" : "Start workout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
