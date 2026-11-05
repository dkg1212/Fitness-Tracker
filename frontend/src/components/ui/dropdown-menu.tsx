import * as Menu from "@radix-ui/react-dropdown-menu"; import type { ComponentProps } from "react"; import { cn } from "@/lib/utils";
export const DropdownMenu = Menu.Root; export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuContent = ({ className, ...p }: ComponentProps<typeof Menu.Content>) => <Menu.Portal><Menu.Content className={cn("z-50 min-w-40 rounded-md border border-border bg-popover p-1 shadow-xl", className)} {...p} /></Menu.Portal>;
export const DropdownMenuItem = ({ className, variant, ...p }: ComponentProps<typeof Menu.Item> & { variant?: "destructive" }) => <Menu.Item className={cn("flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm outline-none hover:bg-accent", variant === "destructive" && "text-destructive", className)} {...p} />;
export const DropdownMenuSeparator = () => <Menu.Separator className="my-1 h-px bg-border" />;
