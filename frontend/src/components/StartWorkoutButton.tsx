import { useState, type ReactNode } from "react";
import { Play } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStartWorkout } from "@/lib/hooks";
import type { WorkoutStart } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  body: WorkoutStart;
  children: ReactNode;
  className?: string;
  /** "card" renders as a dark surface card, any other value is passed to buttonVariants */
  variant?: string;
  testid: string;
};

export default function StartWorkoutButton({ body, children, className, variant, testid }: Props) {
  const [open, setOpen] = useState(false);
  const start = useStartWorkout();

  const isCard = variant === "card";

  const triggerCls = isCard
    ? cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface-card/80 px-4 py-3.5 text-left",
        "sm:px-5 sm:py-4",
        "transition-[border-color,transform,background-color] duration-150",
        "hover:-translate-y-0.5 hover:border-volt/60 hover:bg-surface-card",
        "active:scale-[0.98] active:translate-y-0",
        className,
      )
    : buttonVariants({ variant, className });

  return (
    <>
      <button
        type="button"
        className={triggerCls}
        onClick={() => setOpen(true)}
        disabled={start.isPending}
        data-testid={testid}
      >
        {children}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="start-workout-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-extrabold">
              Start workout?
            </DialogTitle>
            <DialogDescription className="text-base">
              {body.template_id
                ? "Your template will be loaded and a new training session will begin."
                : "A new empty training session will begin. You can add exercises after it starts."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Not now
            </Button>
            <Button
              onClick={() => start.mutate(body)}
              disabled={start.isPending}
              data-testid="start-workout-confirm"
            >
              <Play className="size-4" />
              {start.isPending ? "Starting…" : "Start workout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
