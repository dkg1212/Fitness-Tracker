import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = ({
  variant = "default",
  size = "default",
  className = "",
}: { variant?: string; size?: string; className?: string } = {}) =>
  cn(
    // Base
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150",
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
    // Sizes
    size === "default" && "px-4 py-2 text-sm",
    size === "sm" && "px-3 py-1.5 text-xs",
    size === "lg" && "px-6 py-3 text-base",
    // Variants
    variant === "default" &&
      "bg-volt text-volt-ink hover:brightness-110 shadow-[0_1px_12px_rgba(34,197,94,0.25)]",
    variant === "outline" &&
      "border border-border bg-transparent text-foreground hover:bg-surface-active hover:border-input",
    variant === "ghost" &&
      "bg-transparent text-foreground hover:bg-surface-active",
    variant === "destructive" &&
      "bg-crimson text-white hover:bg-crimson/90",
    className,
  );

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}
