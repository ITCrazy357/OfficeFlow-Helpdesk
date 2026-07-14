"use client";

import { ChevronRight, LogOut, Menu, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/hooks";
import type { AuthUser, UserRole } from "@/features/auth/types";

type DashboardHeaderProps = {
  user: AuthUser;
  onMenuClick: () => void;
};

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  IT_STAFF: "IT Staff",
  EMPLOYEE: "Employee",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function DashboardHeader({
  user,
  onMenuClick,
}: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();

  const currentPage = pathname.startsWith("/tickets/")
    ? pathname.endsWith("/new")
      ? "Tạo ticket"
      : "Chi tiết ticket"
    : pathname.startsWith("/tickets")
      ? "Tickets"
      : pathname.startsWith("/departments")
        ? "Phòng ban"
        : pathname.startsWith("/users")
          ? "Người dùng"
          : "Tổng quan";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-card/95 shadow-sm shadow-slate-900/5 backdrop-blur-xl">
      <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
            aria-label="Mở sidebar"
          >
            <Menu className="size-4" />
          </Button>

          <div className="hidden items-center gap-2 text-sm lg:flex">
            <span className="text-muted-foreground">Workspace</span>
            <ChevronRight className="size-3.5 text-muted-foreground/60" />
            <span className="font-semibold text-foreground">{currentPage}</span>
          </div>

          <div className="min-w-0 lg:hidden">
            <p className="text-sm font-semibold text-foreground">
              OfficeFlow Helpdesk
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Dashboard nội bộ
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-950 text-sm font-semibold text-white shadow-sm shadow-teal-950/15">
            {getInitials(user.name) || <UserRound className="size-4" />}
          </div>

          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {roleLabels[user.role]}
              {user.department?.name ? ` / ${user.department.name}` : ""}
            </p>
          </div>

          <Button type="button" variant="outline" onClick={handleLogout}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Đăng xuất</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
