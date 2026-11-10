import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Table = ({ className, ...p }: TableHTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-auto">
    <table className={cn("w-full text-sm text-foreground", className)} {...p} />
  </div>
);

export const TableHeader = (p: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className="border-b border-border" {...p} />
);

export const TableBody = (p: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} />;

export const TableRow = ({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      "border-b border-border/70 transition-colors hover:bg-surface-active/50",
      className,
    )}
    {...p}
  />
);

export const TableHead = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn("p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}
    {...p}
  />
);

export const TableCell = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("p-3 text-foreground", className)} {...p} />
);
