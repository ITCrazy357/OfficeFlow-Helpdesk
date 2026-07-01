import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

type StateBlockProps = {
  title: string;
  message?: string;
  action?: ReactNode;
};

export function LoadingBlock({
  title = "Đang tải dữ liệu",
}: Partial<StateBlockProps>) {
  return (
    <div className="motion-enter grid min-h-64 place-items-center rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03] backdrop-blur">
      <div className="grid w-full max-w-md gap-4">
        <div className="mx-auto flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700">
          <LoaderCircle className="h-5 w-5 animate-spin text-teal-700" />
          {title}
        </div>
        <div className="grid gap-2">
          <div className="motion-shimmer h-3 rounded-full bg-zinc-100" />
          <div className="motion-shimmer h-3 w-5/6 rounded-full bg-zinc-100" />
          <div className="motion-shimmer h-3 w-2/3 rounded-full bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}

export function ErrorBlock({ title, message, action }: StateBlockProps) {
  return (
    <div className="motion-enter grid min-h-64 place-items-center rounded-2xl border border-red-200 bg-red-50/80 px-6 text-center shadow-sm shadow-red-950/[0.06] ring-1 ring-red-950/[0.03]">
      <div className="grid max-w-md gap-3">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-red-600 shadow-sm">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-semibold text-red-900">{title}</h2>
          {message ? (
            <p className="mt-1 text-sm text-red-700">{message}</p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  );
}

export function EmptyBlock({ title, message, action }: StateBlockProps) {
  return (
    <div className="motion-enter grid min-h-64 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white/80 px-6 text-center shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03] backdrop-blur">
      <div className="grid max-w-md gap-3">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-zinc-100 text-zinc-500 shadow-inner shadow-zinc-950/[0.03]">
          <Inbox className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-semibold text-zinc-900">{title}</h2>
          {message ? (
            <p className="mt-1 text-sm text-zinc-600">{message}</p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  );
}
