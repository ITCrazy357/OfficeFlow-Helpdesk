"use client";

import { LayoutDashboard, LogOut, TicketCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useLogout } from "@/features/auth/hooks";
import type { AuthUser, UserRole } from "@/features/auth/types";

type DashboardHeaderProps = {
  user: AuthUser;
};

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  IT_STAFF: "IT Staff",
  EMPLOYEE: "Employee",
};

const mobileNavigation = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/tickets",
    label: "Tickets",
    icon: TicketCheck,
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {roleLabels[user.role]}
            {user.department?.name ? ` - ${user.department.name}` : ""}
          </p>
        </div>

        <Button type="button" variant="outline" onClick={handleLogout}>
          <LogOut className="size-4" />
          Đăng xuất
        </Button>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-t px-4 py-2 md:hidden">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
