"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LogOut, Plus, Ticket, Users, Workflow } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { useAuth } from "@/features/auth/context/auth-context";

const baseLinks = [
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/tickets/new", label: "Tạo ticket", icon: Plus },
  { href: "/departments", label: "Phòng ban", icon: Building2 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const links =
    user?.role === "ADMIN"
      ? [...baseLinks, { href: "/users", label: "Người dùng", icon: Users }]
      : baseLinks;

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const isLinkActive = (href: string) => {
    if (href === "/tickets") {
      return pathname === href || /^\/tickets\/\d+/.test(pathname);
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-[100dvh] bg-[#f2f5f4]">
        <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-zinc-900/10 bg-[#111817] p-4 text-white shadow-2xl shadow-zinc-950/20 lg:block">
          <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-inner shadow-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-400 text-zinc-950 shadow-lg shadow-teal-950/20">
                <Workflow className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none tracking-[-0.01em]">
                  OfficeFlow
                </p>
                <p className="mt-1 text-xs font-medium text-zinc-300">
                  Helpdesk
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-white/10 bg-zinc-950/30 px-3 py-3">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="mt-0.5 text-xs text-zinc-300">{user?.role}</p>
            </div>
          </div>
          <nav className="grid gap-1.5">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = isLinkActive(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition duration-200 ${
                    isActive
                      ? "bg-teal-400 text-zinc-950 shadow-lg shadow-teal-950/20"
                      : "text-zinc-300 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="lg:pl-72">
          <header className="sticky top-0 z-30 border-b border-white/70 bg-white/85 px-4 py-3 shadow-sm shadow-zinc-950/[0.04] backdrop-blur sm:px-6">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-950 text-white lg:hidden">
                  <Workflow className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-950">
                    {user?.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {user?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  icon={<LogOut className="h-4 w-4" />}
                  onClick={handleLogout}
                >
                  Đăng xuất
                </Button>
              </div>
            </div>
            <nav className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto pb-1 lg:hidden">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = isLinkActive(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                      isActive
                        ? "border-teal-700 bg-teal-700 text-white"
                        : "border-zinc-200 bg-white text-zinc-700"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <main className="mx-auto grid max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:gap-7 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
