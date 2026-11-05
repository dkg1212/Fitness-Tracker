import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  actions,
  testid,
}: {
  eyebrow: string;
  title: ReactNode;
  actions?: ReactNode;
  testid?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up lg:mb-8">
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-volt">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl" data-testid={testid}>
          {title}
        </h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
