import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export const DropdownMenuContent = ({ className, ...p }: ComponentProps<typeof Menu.Content>) => (
  <Menu.Portal>
    <Menu.Content
      className={cn(
        "z-50 min-w-40 rounded-md border border-border bg-popover text-popover-foreground p-1 shadow-xl",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...p}
    />
  </Menu.Portal>
);

export const DropdownMenuItem = ({
  className,
  variant,
  ...p
}: ComponentProps<typeof Menu.Item> & { variant?: "destructive" }) => (
  <Menu.Item
    className={cn(
      "flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-popover-foreground outline-none",
      "hover:bg-accent hover:text-accent-foreground",
      "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      variant === "destructive" && "text-destructive hover:text-destructive data-[highlighted]:text-destructive",
      className,
    )}
    {...p}
  />
);

export const DropdownMenuSeparator = () => <Menu.Separator className="my-1 h-px bg-border" />;
