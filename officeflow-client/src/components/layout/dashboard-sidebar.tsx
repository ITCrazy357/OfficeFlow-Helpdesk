"use client";

import {
  BookOpenText,
  Boxes,
  Building2,
  CalendarRange,
  Clock3,
  LayoutDashboard,
  ScrollText,
  Tags,
  TicketCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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
    label: "Tổng quan",
    description: "Yêu cầu và tiến độ",
    icon: LayoutDashboard,
  },
  {
    href: "/tickets",
    label: "Tickets",
    description: "Yêu cầu hỗ trợ",
    icon: TicketCheck,
  },
  {
    href: "/leave-requests",
    label: "Nghỉ phép",
    description: "Đơn nghỉ và phê duyệt",
    icon: CalendarRange,
  },
  {
    href: "/assets",
    label: "Quản lý tài sản",
    description: "Thiết bị nội bộ",
    icon: Boxes,
  },
  {
    href: "/knowledge",
    label: "Kho kiến thức",
    description: "FAQ nội bộ",
    icon: BookOpenText,
  },
  {
    href: "/departments",
    label: "Phòng ban",
    description: "Cơ cấu tổ chức",
    icon: Building2,
  },
  {
    href: "/users",
    label: "Người dùng",
    description: "Quản lý tài khoản",
    icon: Users,
    roles: ["ADMIN", "IT_STAFF"],
  },
  {
    href: "/ticket-categories",
    label: "Danh mục ticket",
    description: "Phân loại yêu cầu",
    icon: Tags,
    roles: ["ADMIN"],
  },
  {
    href: "/audit-logs",
    label: "Nhật ký hệ thống",
    description: "Hoạt động và thay đổi",
    icon: ScrollText,
    roles: ["ADMIN"],
  },
  {
    href: "/sla",
    label: "Chính sách SLA",
    description: "Lịch và thời hạn hỗ trợ",
    icon: Clock3,
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
        <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
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
    <nav aria-label="Điều hướng chính" className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto p-3">
      {navigationItems
        .filter((item) => !item.roles || item.roles.includes(userRole))
        .map((item, index) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <div key={item.href}>
              {index === 0 || item.href === "/users" ? <p className="px-3 pb-2 pt-4 text-xs font-medium text-muted-foreground">{index === 0 ? "Không gian làm việc" : "Quản trị"}</p> : null}
            <Link
              href={item.href}
              onClick={onNavigate}
              data-active={active}
              aria-current={active ? "page" : undefined}
              className={cn(
                "motion-nav group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center transition-colors",
                  active
                    ? "text-sidebar-primary"
                    : "text-muted-foreground group-hover:text-sidebar-primary",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block leading-tight">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </Link>
            </div>
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
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const desktop = window.matchMedia("(min-width: 768px)");
    const handleResize = () => { if (desktop.matches) onClose(); };
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const items = panel.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    desktop.addEventListener("change", handleResize);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handleKey);
      desktop.removeEventListener("change", handleResize);
      previous?.focus();
    };
  }, [isOpen, onClose]);
  return (
    <>
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-card p-3 text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Đến nội dung chính</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="border-b border-sidebar-border">
          <BrandBlock />
        </div>
        <SidebarNav userRole={userRole} />
        <div className="mx-5 mb-6 mt-auto border-t border-sidebar-border pt-4 text-xs text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground">OfficeFlow Helpdesk</p>
            <p className="mt-0.5">Không gian làm việc nội bộ</p>
          </div>
        </div>
      </aside>

      <button
        type="button"
        aria-label="Đóng sidebar"
        tabIndex={isOpen ? 0 : -1}
        aria-hidden={!isOpen}
        className={cn(
          "fixed inset-0 z-40 bg-foreground/35 backdrop-blur-[2px] transition-opacity md:hidden",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        ref={panel}
        role={isOpen ? "dialog" : undefined}
        aria-modal={isOpen ? true : undefined}
        aria-label="Điều hướng"
        inert={!isOpen}
        aria-hidden={!isOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col border-r bg-sidebar shadow-2xl shadow-foreground/15 transition-transform duration-300 ease-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b bg-card/70 pr-3">
          <BrandBlock />
          <Button
            ref={closeButton}
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
