"use client";

import {
  ChevronRight,
  LogOut,
  Menu,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useLogout, useLogoutAll } from "@/features/auth/hooks";
import type { AuthUser, UserRole } from "@/features/auth/types";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { getApiErrorMessage } from "@/lib/axios";

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

function getCurrentPageLabel(pathname: string) {
  if (pathname.startsWith("/leave-requests/")) {
    return pathname.endsWith("/new")
      ? "Tạo đơn nghỉ phép"
      : "Chi tiết đơn nghỉ phép";
  }

  if (pathname.startsWith("/leave-requests")) {
    return "Nghỉ phép";
  }

  if (pathname.startsWith("/tickets/")) {
    return pathname.endsWith("/new") ? "Tạo ticket" : "Chi tiết ticket";
  }

  if (pathname.startsWith("/tickets")) {
    return "Tickets";
  }

  if (pathname.startsWith("/knowledge")) {
    return "Knowledge Base";
  }

  if (pathname.startsWith("/notifications")) {
    return "Thông báo";
  }

  if (pathname.startsWith("/departments")) {
    return "Phòng ban";
  }

  if (pathname.startsWith("/users")) {
    return "Người dùng";
  }

  return "Tổng quan";
}

export function DashboardHeader({ user, onMenuClick }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  const logoutAll = useLogoutAll();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [logoutScope, setLogoutScope] = useState<"current" | "all" | null>(
    null,
  );
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const currentPage = getCurrentPageLabel(pathname);

  async function handleLogout(scope: "current" | "all") {
    setLogoutScope(scope);
    setLogoutError(null);

    try {
      if (scope === "all") {
        await logoutAll();
      } else {
        await logout();
      }

      setIsLogoutDialogOpen(false);
      router.replace("/login");
    } catch (error) {
      if (scope === "current") {
        setIsLogoutDialogOpen(false);
        router.replace("/login");
        return;
      }

      setLogoutError(
        getApiErrorMessage(
          error,
          "Không thể đăng xuất khỏi tất cả thiết bị. Vui lòng thử lại.",
        ),
      );
    } finally {
      setLogoutScope(null);
    }
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
          <NotificationBell />

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

          <AlertDialog
            open={isLogoutDialogOpen}
            onOpenChange={(open) => {
              if (logoutScope) return;
              setIsLogoutDialogOpen(open);
              if (open) setLogoutError(null);
            }}
          >
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" className="px-3 sm:px-4">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                  <ShieldAlert className="size-5" />
                </div>
                <AlertDialogHeader>
                  <AlertDialogTitle>Bạn muốn đăng xuất ở đâu?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Chỉ đăng xuất thiết bị đang dùng, hoặc thu hồi toàn bộ phiên
                    đăng nhập trên tất cả thiết bị của tài khoản này.
                  </AlertDialogDescription>
                </AlertDialogHeader>
              </div>

              {logoutError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive"
                >
                  {logoutError}
                </p>
              ) : null}

              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={logoutScope !== null}
                  >
                    Ở lại
                  </Button>
                </AlertDialogCancel>

                <AlertDialogAction asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={logoutScope !== null}
                    onClick={(event) => {
                      event.preventDefault();
                      void handleLogout("current");
                    }}
                  >
                    {logoutScope === "current"
                      ? "Đang đăng xuất..."
                      : "Thiết bị này"}
                  </Button>
                </AlertDialogAction>

                <AlertDialogAction asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={logoutScope !== null}
                    onClick={(event) => {
                      event.preventDefault();
                      void handleLogout("all");
                    }}
                  >
                    <ShieldAlert className="size-4" />
                    {logoutScope === "all"
                      ? "Đang thu hồi..."
                      : "Tất cả thiết bị"}
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  );
}
