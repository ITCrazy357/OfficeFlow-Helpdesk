"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Eye, Inbox, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  formatNotificationRelativeTime,
  getNotificationMeta,
} from "../constants";
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationCount,
} from "../hooks";
import type { NotificationItem } from "../types";

const DROPDOWN_PAGE_SIZE = 6;
const NOTIFICATION_POLL_INTERVAL_MS = 15_000;

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

type NotificationRowProps = {
  notification: NotificationItem;
  index: number;
  isMarking: boolean;
  onOpen: (notification: NotificationItem) => void;
  onMarkRead: (notification: NotificationItem) => void;
};

function NotificationRow({
  notification,
  index,
  isMarking,
  onOpen,
  onMarkRead,
}: NotificationRowProps) {
  const meta = getNotificationMeta(notification.type);
  const Icon = meta.icon;

  function handleMarkRead(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onMarkRead(notification);
  }

  return (
    <button
      type="button"
      className={cn(
        "motion-card w-full rounded-lg border p-3 text-left transition-colors",
        notification.isRead
          ? "bg-card hover:bg-muted/35"
          : "border-teal-200 bg-teal-50/55 hover:bg-teal-50",
      )}
      style={{ "--motion-index": index } as CSSProperties}
      onClick={() => onOpen(notification)}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg ring-1",
            meta.iconTone,
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-semibold">
                {notification.title}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {notification.message}
              </p>
            </div>
            {!notification.isRead ? (
              <span className="mt-1 size-2 shrink-0 rounded-full bg-teal-700" />
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("motion-badge", meta.tone)}>
              {meta.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatNotificationRelativeTime(notification.createdAt)}
            </span>
            {!notification.isRead ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="ml-auto h-7"
                onClick={handleMarkRead}
                disabled={isMarking}
              >
                {isMarking ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Eye className="size-3" />
                )}
                Đã đọc
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const previousUnreadCountRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showNewSignal, setShowNewSignal] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);

  const unreadCountQuery = useUnreadNotificationCount({
    refetchInterval: NOTIFICATION_POLL_INTERVAL_MS,
  });
  const notificationsQuery = useNotifications(
    { page: 1, limit: DROPDOWN_PAGE_SIZE },
    {
      enabled: isOpen,
      refetchInterval: isOpen ? NOTIFICATION_POLL_INTERVAL_MS : false,
    },
  );
  const markRead = useMarkNotificationAsRead();
  const markAllRead = useMarkAllNotificationsAsRead();

  const unreadCount = unreadCountQuery.data ?? 0;
  const notifications = notificationsQuery.data?.items ?? [];

  useEffect(() => {
    const previousCount = previousUnreadCountRef.current;

    if (previousCount !== null && unreadCount > previousCount) {
      setShowNewSignal(true);
      const timeoutId = window.setTimeout(() => {
        setShowNewSignal(false);
      }, 4_000);

      previousUnreadCountRef.current = unreadCount;
      return () => window.clearTimeout(timeoutId);
    }

    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  async function handleOpenNotification(notification: NotificationItem) {
    if (!notification.isRead) {
      setMarkingId(notification.id);

      try {
        await markRead.mutateAsync(notification.id);
      } finally {
        setMarkingId(null);
      }
    }

    setIsOpen(false);

    if (notification.targetUrl) {
      router.push(notification.targetUrl);
    }
  }

  async function handleMarkRead(notification: NotificationItem) {
    if (notification.isRead) {
      return;
    }

    setMarkingId(notification.id);

    try {
      await markRead.mutateAsync(notification.id);
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAllRead() {
    await markAllRead.mutateAsync();
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          "relative",
          showNewSignal && "ring-2 ring-teal-300 ring-offset-2 ring-offset-card",
        )}
        onClick={() => {
          setIsOpen((value) => !value);
          setShowNewSignal(false);
        }}
        aria-label="Mở thông báo"
        aria-expanded={isOpen}
      >
        <Bell className={cn("size-4", showNewSignal && "animate-pulse")} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[0.65rem] font-bold leading-5 text-white shadow-sm">
            {formatUnreadCount(unreadCount)}
          </span>
        ) : null}
      </Button>

      {showNewSignal ? (
        <div className="motion-toast pointer-events-none absolute right-0 top-12 z-50 hidden w-44 rounded-lg border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-lg sm:block">
          Có thông báo mới
        </div>
      ) : null}

      {isOpen ? (
        <div className="motion-panel absolute right-0 top-12 z-50 w-[min(92vw,390px)] rounded-xl border bg-card p-3 shadow-2xl shadow-slate-900/14">
          <div className="flex items-start justify-between gap-3 border-b pb-3">
            <div>
              <p className="text-sm font-semibold">Thông báo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} thông báo chưa đọc`
                  : "Bạn đã đọc hết thông báo"}
              </p>
            </div>
            <div className="flex gap-1">
              {unreadCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleMarkAllRead}
                  disabled={markAllRead.isPending}
                  aria-label="Đánh dấu tất cả đã đọc"
                >
                  {markAllRead.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCheck className="size-4" />
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng thông báo"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 max-h-[440px] overflow-y-auto pr-1">
            {notificationsQuery.isLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-20 rounded-lg bg-muted motion-shimmer"
                  />
                ))}
              </div>
            ) : notificationsQuery.isError ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">
                  Không thể tải thông báo.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => notificationsQuery.refetch()}
                >
                  Thử lại
                </Button>
              </div>
            ) : notifications.length ? (
              <div className="grid gap-2">
                {notifications.map((notification, index) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    index={index}
                    isMarking={markingId === notification.id}
                    onOpen={handleOpenNotification}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </div>
            ) : (
              <div className="grid min-h-48 place-items-center rounded-lg border border-dashed p-5 text-center">
                <div>
                  <Inbox className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold">
                    Chưa có thông báo
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Các cập nhật ticket sẽ xuất hiện tại đây.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 border-t pt-3">
            <Button asChild type="button" variant="outline" className="w-full">
              <Link href="/notifications" onClick={() => setIsOpen(false)}>
                Xem tất cả thông báo
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
