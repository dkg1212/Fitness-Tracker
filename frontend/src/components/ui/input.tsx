import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground/70 outline-none",
        "focus:border-volt focus:ring-2 focus:ring-volt/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
