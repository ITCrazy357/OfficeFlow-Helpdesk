"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  Loader2,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import {
  formatNotificationDate,
  formatNotificationRelativeTime,
  getNotificationMeta,
} from "@/features/notifications/constants";
import {
  useDeleteNotification,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/features/notifications/hooks";
import type {
  GetNotificationsParams,
  NotificationItem,
} from "@/features/notifications/types";
import { getApiErrorMessage } from "@/lib/axios";

const PAGE_SIZE = 10;
const NOTIFICATIONS_POLL_INTERVAL_MS = 15_000;

type ReadFilter = "ALL" | "UNREAD" | "READ";

function NotificationsSkeleton() {
  return (
    <Card>
      <CardContent className="grid gap-3 pt-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-lg bg-muted motion-shimmer"
          />
        ))}
      </CardContent>
    </Card>
  );
}

function NotificationCard({
  notification,
  index,
  isMarking,
  isDeleting,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  notification: NotificationItem;
  index: number;
  isMarking: boolean;
  isDeleting: boolean;
  onOpen: (notification: NotificationItem) => void;
  onMarkRead: (notification: NotificationItem) => void;
  onDelete: (notification: NotificationItem) => void;
}) {
  const meta = getNotificationMeta(notification.type);
  const Icon = meta.icon;

  function handleMarkRead(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onMarkRead(notification);
  }

  function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onDelete(notification);
  }

  return (
    <button
      type="button"
      className={cn(
        "motion-card w-full rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-teal-200 hover:bg-teal-50/30",
        !notification.isRead && "border-teal-200 bg-teal-50/45",
      )}
      style={{ "--motion-index": index } as CSSProperties}
      onClick={() => onOpen(notification)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-lg ring-1",
              meta.iconTone,
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("motion-badge", meta.tone)}>
                {meta.label}
              </Badge>
              {!notification.isRead ? (
                <Badge
                  variant="outline"
                  className="motion-badge border-teal-200 bg-teal-50 text-teal-800"
                >
                  Chưa đọc
                </Badge>
              ) : (
                <Badge variant="outline" className="motion-badge">
                  Đã đọc
                </Badge>
              )}
            </div>
            <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-snug">
              {notification.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {notification.message}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {formatNotificationRelativeTime(notification.createdAt)} /{" "}
              {formatNotificationDate(notification.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!notification.isRead ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkRead}
              disabled={isMarking}
            >
              {isMarking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Eye className="size-4" />
              )}
              Đánh dấu đã đọc
            </Button>
          ) : null}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Xóa
          </Button>
        </div>
      </div>
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<ReadFilter>("ALL");
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const params = useMemo<GetNotificationsParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      isRead:
        readFilter === "ALL" ? undefined : readFilter === "READ",
    }),
    [page, readFilter],
  );

  const notificationsQuery = useNotifications(params, {
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
  });
  const unreadCountQuery = useUnreadNotificationCount({
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
  });
  const markRead = useMarkNotificationAsRead();
  const markAllRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();

  const notifications = notificationsQuery.data?.items ?? [];
  const pagination = notificationsQuery.data?.pagination;
  const unreadCount = unreadCountQuery.data ?? 0;
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);
  const currentPage = pagination?.page ?? page;
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  async function handleOpenNotification(notification: NotificationItem) {
    setActionError(null);

    if (!notification.isRead) {
      setMarkingId(notification.id);

      try {
        await markRead.mutateAsync(notification.id);
      } catch (error) {
        setActionError(
          getApiErrorMessage(error, "Không thể đánh dấu thông báo đã đọc."),
        );
      } finally {
        setMarkingId(null);
      }
    }

    if (notification.targetUrl) {
      router.push(notification.targetUrl);
    }
  }

  async function handleMarkRead(notification: NotificationItem) {
    if (notification.isRead) {
      return;
    }

    setActionError(null);
    setMarkingId(notification.id);

    try {
      await markRead.mutateAsync(notification.id);
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "Không thể đánh dấu thông báo đã đọc."),
      );
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAllRead() {
    setActionError(null);

    try {
      await markAllRead.mutateAsync();
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, "Không thể đánh dấu tất cả đã đọc."),
      );
    }
  }

  async function handleDelete(notification: NotificationItem) {
    setActionError(null);
    setDeletingId(notification.id);

    try {
      await deleteNotification.mutateAsync(notification.id);
    } catch (error) {
      setActionError(getApiErrorMessage(error, "Không thể xóa thông báo."));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-6 motion-enter">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <CheckCheck className="size-3.5" />
            Notification Center
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Tất cả thông báo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi cập nhật ticket, SLA và các thay đổi liên quan đến bạn.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || markAllRead.isPending}
        >
          {markAllRead.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCheck className="size-4" />
          )}
          Đánh dấu tất cả đã đọc
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Chưa đọc", unreadCount],
          ["Đang hiển thị", notifications.length],
          ["Tổng thông báo", pagination?.totalItems ?? 0],
        ].map(([label, value], index) => (
          <Card
            key={label}
            className="motion-card shadow-sm"
            style={{ "--motion-index": index } as CSSProperties}
          >
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card className="shadow-sm motion-panel">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Bộ lọc</CardTitle>
              <CardDescription>
                Lọc nhanh theo trạng thái đã đọc hoặc chưa đọc.
              </CardDescription>
            </div>
            <Select
              value={readFilter}
              onValueChange={(value) => {
                setReadFilter(value as ReadFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Trạng thái đọc" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả</SelectItem>
                <SelectItem value="UNREAD">Chưa đọc</SelectItem>
                <SelectItem value="READ">Đã đọc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {actionError ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
          {actionError}
        </div>
      ) : null}

      {notificationsQuery.isLoading ? (
        <NotificationsSkeleton />
      ) : notificationsQuery.isError ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-start gap-3 pt-0">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <div className="grid gap-3">
              <div>
                <CardTitle>Không thể tải thông báo</CardTitle>
                <CardDescription className="mt-1">
                  {getApiErrorMessage(
                    notificationsQuery.error,
                    "Không thể tải danh sách thông báo.",
                  )}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => notificationsQuery.refetch()}
              >
                Thử lại
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : notifications.length ? (
        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>Danh sách thông báo</CardTitle>
            <CardDescription>
              {pagination
                ? `${pagination.totalItems} thông báo`
                : "Không có dữ liệu phân trang"}
              {notificationsQuery.isFetching ? " / Đang cập nhật" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0">
            {notifications.map((notification, index) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                index={index}
                isMarking={markingId === notification.id}
                isDeleting={deletingId === notification.id}
                onOpen={handleOpenNotification}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="grid min-h-72 place-items-center px-4 text-center">
            <div className="max-w-md">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-800">
                <Inbox className="size-5" />
              </div>
              <p className="font-medium">Chưa có thông báo phù hợp</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Thử đổi bộ lọc hoặc quay lại sau khi có cập nhật ticket mới.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Trang {currentPage} / {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((value) => Math.max(value - 1, 1))}
            disabled={!canGoPrevious || notificationsQuery.isFetching}
          >
            <ChevronLeft className="size-4" />
            Trước
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((value) => value + 1)}
            disabled={!canGoNext || notificationsQuery.isFetching}
          >
            Sau
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
