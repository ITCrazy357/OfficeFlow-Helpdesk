"use client";

import { LogOut, Menu, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

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
  const logout = useLogout();

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

          <div className="hidden h-10 min-w-80 items-center gap-2 rounded-lg border bg-muted/55 px-3 text-sm text-muted-foreground shadow-inner shadow-white/40 lg:flex">
            <Search className="size-4 text-teal-700" />
            <span>Tìm kiếm và lọc nhanh trong trang Tickets</span>
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
