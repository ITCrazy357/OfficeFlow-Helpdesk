import { Workflow } from "lucide-react";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  children: ReactNode;
};

export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#f2f5f4] px-4 py-8">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl shadow-zinc-950/10 ring-1 ring-zinc-950/[0.04] lg:grid-cols-[0.86fr_1fr]">
        <div className="relative hidden min-h-[600px] bg-[#111817] p-8 text-white lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-400 text-zinc-950 shadow-lg shadow-teal-950/20">
              <Workflow className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl font-semibold tracking-[-0.01em]">
                OfficeFlow
              </p>
              <p className="text-sm font-medium text-zinc-300">Helpdesk</p>
            </div>
          </div>

          <div className="mt-auto grid gap-4">
            <div className="h-px bg-white/10" />
            <p className="max-w-sm text-3xl font-semibold leading-tight tracking-[-0.02em]">
              Quản lý ticket nội bộ trong một workspace gọn gàng.
            </p>
          </div>
        </div>

        <div className="grid content-center px-5 py-8 sm:px-10 lg:px-12">
          <div className="mb-8">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-zinc-950 text-white shadow-lg shadow-zinc-950/15 lg:hidden">
              <Workflow className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-teal-700">OfficeFlow</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-zinc-950">
              {title}
            </h1>
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
