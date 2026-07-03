"use client";

import { LayoutDashboard, TicketCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui/utils";

const navigationItems = [
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

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-background md:flex md:flex-col">
      <div className="border-b px-5 py-4">
        <p className="text-lg font-semibold text-foreground">OfficeFlow</p>
        <p className="text-sm text-muted-foreground">Helpdesk</p>
      </div>

      <nav className="grid gap-1 p-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "motion-nav flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
