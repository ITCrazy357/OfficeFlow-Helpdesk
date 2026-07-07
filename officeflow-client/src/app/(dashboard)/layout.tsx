"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { useLogout, useMe } from "@/features/auth/hooks";

type Props = {
  children: ReactNode;
};

function DashboardLoading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-5 shadow-sm motion-panel">
        <div className="mb-3 h-4 w-40 rounded-full bg-muted motion-shimmer" />
        <div className="grid gap-2">
          <div className="h-3 rounded-full bg-muted motion-shimmer" />
          <div className="h-3 w-4/5 rounded-full bg-muted motion-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: Props) {
  const router = useRouter();
  const logout = useLogout();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data: user, isError, isLoading } = useMe();

  useEffect(() => {
    if (isError) {
      logout();
      router.replace("/login");
    }
  }, [isError, logout, router]);

  if (isLoading) {
    return <DashboardLoading />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <DashboardSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userRole={user.role}
      />
      <div className="min-h-[100dvh] md:pl-64">
        <DashboardHeader
          user={user}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
