import * as SelectPrimitive from "@radix-ui/react-select";
import type { ComponentProps } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = ({ className, children, ...p }: ComponentProps<typeof SelectPrimitive.Trigger>) => (
  <SelectPrimitive.Trigger
    className={cn(
      "flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
      "placeholder:text-muted-foreground focus:border-volt focus:ring-2 focus:ring-volt/30 focus:outline-none",
      "data-[placeholder]:text-muted-foreground",
      className,
    )}
    {...p}
  >
    {children}
    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
  </SelectPrimitive.Trigger>
);

export const SelectContent = ({ className, children, ...p }: ComponentProps<typeof SelectPrimitive.Content>) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      className={cn(
        "z-50 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-xl",
        className,
      )}
      {...p}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
);

export const SelectItem = ({ className, children, ...p }: ComponentProps<typeof SelectPrimitive.Item>) => (
  <SelectPrimitive.Item
    className={cn(
      "relative cursor-pointer select-none rounded px-8 py-2 text-sm text-popover-foreground outline-none",
      "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...p}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4 text-volt" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
);
