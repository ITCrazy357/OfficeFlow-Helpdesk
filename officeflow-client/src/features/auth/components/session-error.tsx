"use client";

import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/axios";

export function SessionError({
  error,
  isRetrying,
  onRetry,
}: {
  error: unknown;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold">
          Không thể tải thông tin tài khoản
        </h1>
        <p role="alert" className="mt-2 text-sm text-muted-foreground">
          {getApiErrorMessage(error)}
        </p>
        <Button className="mt-4" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? "Đang thử lại..." : "Thử lại"}
        </Button>
      </div>
    </main>
  );
}
