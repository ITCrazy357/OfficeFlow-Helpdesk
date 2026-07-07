"use client";

import { Building2, LayoutDashboard, TicketCheck, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import type { UserRole } from "@/features/auth/types";

type DashboardSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
};

type NavigationItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
};

const navigationItems: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Tổng quan",
    icon: LayoutDashboard,
  },
  {
    href: "/tickets",
    label: "Tickets",
    description: "Yêu cầu hỗ trợ",
    icon: TicketCheck,
  },
  {
    href: "/departments",
    label: "Departments",
    description: "Phòng ban",
    icon: Building2,
  },
  {
    href: "/users",
    label: "Users",
    description: "Tài khoản",
    icon: Users,
    roles: ["ADMIN"],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandBlock() {
  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-teal-950 text-sm font-semibold text-white shadow-sm shadow-teal-950/20">
          OF
        </div>
        <div>
          <p className="text-lg font-semibold leading-tight text-foreground">
            OfficeFlow
          </p>
          <p className="text-sm text-muted-foreground">Helpdesk</p>
        </div>
      </div>
    </div>
  );
}

function SidebarNav({
  onNavigate,
  userRole,
}: {
  onNavigate?: () => void;
  userRole: UserRole;
}) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1.5 p-3">
      {navigationItems
        .filter((item) => !item.roles || item.roles.includes(userRole))
        .map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              data-active={active}
              className={cn(
                "motion-nav group flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                active
                  ? "bg-teal-950 text-white shadow-sm shadow-teal-950/15"
                  : "text-muted-foreground hover:bg-teal-50 hover:text-teal-950",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg border transition-colors",
                  active
                    ? "border-white/15 bg-white/10 text-white"
                    : "border-border bg-card text-teal-800 group-hover:border-teal-200 group-hover:bg-white",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block leading-tight">{item.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-xs font-normal",
                    active ? "text-white/72" : "text-muted-foreground",
                  )}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
    </nav>
  );
}

export function DashboardSidebar({
  isOpen,
  onClose,
  userRole,
}: DashboardSidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar/95 shadow-sm backdrop-blur md:flex md:flex-col">
        <div className="border-b bg-card/70">
          <BrandBlock />
        </div>
        <SidebarNav userRole={userRole} />
        <div className="m-3 mt-auto rounded-lg border bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-sm">
          <p className="font-semibold text-foreground">OfficeFlow API</p>
          <p className="mt-1">Bearer token authentication</p>
        </div>
      </aside>

      <button
        type="button"
        aria-label="Đóng sidebar"
        className={cn(
          "fixed inset-0 z-40 bg-foreground/35 backdrop-blur-[2px] transition-opacity md:hidden",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col border-r bg-sidebar shadow-2xl shadow-foreground/15 transition-transform duration-300 ease-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b bg-card/70 pr-3">
          <BrandBlock />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Đóng sidebar"
          >
            <X className="size-4" />
          </Button>
        </div>
        <SidebarNav onNavigate={onClose} userRole={userRole} />
      </aside>
    </>
  );
}
