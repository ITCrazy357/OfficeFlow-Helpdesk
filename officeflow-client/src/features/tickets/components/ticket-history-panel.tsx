"use client";

import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime, getHistoryActionLabel } from "../ticket-detail.utils";
import type { TicketHistory } from "../types";

type TicketHistoryPanelProps = {
  items: TicketHistory[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function TicketHistoryPanel({
  items,
  isLoading,
  isError,
  onRetry,
}: TicketHistoryPanelProps) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <div>
            <CardTitle>Lịch sử ticket</CardTitle>
            <CardDescription>
              Các thay đổi được ghi nhận tự động.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-16 rounded-lg bg-muted motion-shimmer"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">
              Không thể tải lịch sử.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRetry}
            >
              Thử lại
            </Button>
          </div>
        ) : items.length ? (
          <div className="grid gap-4">
            {items.map((item) => (
              <div key={item.id} className="relative pl-5">
                <span className="absolute left-0 top-1.5 size-2.5 rounded-full bg-teal-800" />
                <p className="text-sm font-semibold">
                  {getHistoryActionLabel(item.action)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.user.name} / {formatDateTime(item.createdAt)}
                </p>
                {item.oldValue || item.newValue ? (
                  <p className="mt-2 rounded-lg bg-muted/45 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {item.oldValue ? `${item.oldValue} → ` : ""}
                    {item.newValue ?? ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <History className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Chưa có lịch sử</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
