"use client";

import { useEffect } from "react";
import { CircleCheck, CircleX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type AssetToastProps = {
  message: string | null;
  tone?: "success" | "error";
  onClose: () => void;
};

export function AssetToast({
  message,
  tone = "success",
  onClose,
}: AssetToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(onClose, 4_000);
    return () => window.clearTimeout(timeoutId);
  }, [message, onClose]);

  if (!message) {
    return null;
  }

  const Icon = tone === "success" ? CircleCheck : CircleX;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "motion-toast fixed right-4 top-20 z-[70] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-lg border bg-card p-3 shadow-xl sm:w-96",
        tone === "success"
          ? "border-emerald-200"
          : "border-destructive/25",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          tone === "success"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-destructive/10 text-destructive",
        )}
      >
        <Icon className="size-4" />
      </span>
      <p className="min-w-0 flex-1 pt-1.5 text-sm font-medium leading-5">
        {message}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label="Đóng thông báo"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
