import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/75 px-4 py-4 shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03] backdrop-blur sm:flex-row sm:items-end sm:justify-between sm:px-5">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-zinc-950 sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-zinc-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
