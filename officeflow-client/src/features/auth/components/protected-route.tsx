"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ErrorBlock, LoadingBlock } from "@/shared/components/ui/state-block";
import { useAuth } from "@/features/auth/context/auth-context";
import type { UserRole } from "@/features/auth/types";

type ProtectedRouteProps = {
  children: ReactNode;
  roles?: UserRole[];
};

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  if (isLoading) {
    return <LoadingBlock title="Đang kiểm tra phiên đăng nhập" />;
  }

  if (!user) {
    return null;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <ErrorBlock
        title="Không có quyền truy cập"
        message="Tài khoản hiện tại không có quyền truy cập trang này."
      />
    );
  }

  return children;
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/tickets");
    }
  }, [isLoading, router, user]);

  if (isLoading) {
    return <LoadingBlock title="Đang kiểm tra phiên đăng nhập" />;
  }

  if (user) {
    return null;
  }

  return children;
}
