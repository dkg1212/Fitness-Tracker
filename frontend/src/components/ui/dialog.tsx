import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg",
          "-translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border",
          "bg-popover text-popover-foreground p-6 shadow-2xl",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const DialogHeader = ({ className, ...p }: ComponentProps<"div">) => (
  <div className={cn("space-y-2", className)} {...p} />
);

export const DialogFooter = ({ className, ...p }: ComponentProps<"div">) => (
  <div className={cn("mt-5 flex flex-wrap justify-end gap-2", className)} {...p} />
);

export const DialogTitle = ({ className, ...p }: ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title
    className={cn("text-lg font-bold text-popover-foreground", className)}
    {...p}
  />
);

export const DialogDescription = ({ className, ...p }: ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description
    className={cn("text-sm text-muted-foreground", className)}
    {...p}
  />
);
