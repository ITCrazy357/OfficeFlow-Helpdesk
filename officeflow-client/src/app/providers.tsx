"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/shared/components/toast/toast-provider";
import { AuthProvider } from "@/features/auth/context/auth-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}

