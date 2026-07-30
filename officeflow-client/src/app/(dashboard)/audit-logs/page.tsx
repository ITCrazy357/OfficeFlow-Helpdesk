"use client";

import type { CSSProperties } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilterX,
  History,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/components/ui/utils";
import {
  auditLogActionOptions,
  auditLogEntityOptions,
  formatAuditLogDate,
  getAuditLogActionMeta,
  getAuditLogEntityLabel,
} from "@/features/audit-logs/constants";
import { AuditLogDetailDrawer } from "@/features/audit-logs/components/audit-log-detail-drawer";
import { useAuditLogs } from "@/features/audit-logs/hooks";
import type {
  AuditLogAction,
  AuditLogEntity,
  GetAuditLogsParams,
} from "@/features/audit-logs/types";
import { useMe } from "@/features/auth/hooks";
import { useUsers } from "@/features/users/hooks";
import { getApiErrorMessage } from "@/lib/axios";

const SEARCH_DEBOUNCE_MS = 400;

type EntityFilter = "ALL" | AuditLogEntity;
type ActionFilter = "ALL" | AuditLogAction;

function toDateBoundary(value: string, endOfDay: boolean) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function AuditLogsSkeleton() {
  return (
    <Card>
      <CardContent className="grid gap-3 pt-0">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="h-16 rounded-lg bg-muted motion-shimmer"
          />
        ))}
      </CardContent>
    </Card>
  );
}

function AuditLogsError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardContent className="flex items-start gap-3 pt-0">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </span>
        <div className="min-w-0">
          <CardTitle>Không thể tải Audit Log</CardTitle>
          <CardDescription className="mt-1">
            {getApiErrorMessage(error, "Không thể tải danh sách Audit Log.")}
          </CardDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={onRetry}
          >
            Thử lại
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AuditLogsPage() {
  const { data: me } = useMe();
  const isAdmin = me?.role === "ADMIN";
  const usersQuery = useUsers(isAdmin);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("ALL");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("ALL");
  const [actorFilter, setActorFilter] = useState("ALL");
  const [entityId, setEntityId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedAuditLogId, setSelectedAuditLogId] =
    useState<number | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [keyword]);

  const dateRangeInvalid = Boolean(
    fromDate && toDate && fromDate > toDate,
  );

  const params = useMemo<GetAuditLogsParams>(() => {
    const parsedActorId = Number(actorFilter);
    const parsedEntityId = Number(entityId);

    return {
      page,
      limit,
      entity: entityFilter === "ALL" ? undefined : entityFilter,
      action: actionFilter === "ALL" ? undefined : actionFilter,
      actorId:
        Number.isInteger(parsedActorId) && parsedActorId > 0
          ? parsedActorId
          : undefined,
      entityId:
        Number.isInteger(parsedEntityId) && parsedEntityId > 0
          ? parsedEntityId
          : undefined,
      keyword: debouncedKeyword || undefined,
      from: toDateBoundary(fromDate, false),
      to: toDateBoundary(toDate, true),
    };
  }, [
    actionFilter,
    actorFilter,
    debouncedKeyword,
    entityFilter,
    entityId,
    fromDate,
    limit,
    page,
    toDate,
  ]);

  const auditLogsQuery = useAuditLogs(
    params,
    isAdmin && !dateRangeInvalid,
  );
  const auditLogs = auditLogsQuery.data?.items ?? [];
  const pagination = auditLogsQuery.data?.pagination;
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);
  const currentPage = pagination?.page ?? page;
  const users = usersQuery.data ?? [];

  const closeDetail = useCallback(() => {
    setSelectedAuditLogId(null);
  }, []);

  function resetPage() {
    setPage(1);
  }

  function clearFilters() {
    setKeyword("");
    setDebouncedKeyword("");
    setEntityFilter("ALL");
    setActionFilter("ALL");
    setActorFilter("ALL");
    setEntityId("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  if (!me) {
    return <AuditLogsSkeleton />;
  }

  if (!isAdmin) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 motion-enter">
        <CardContent className="flex items-start gap-3 pt-0">
          <span className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <Shield className="size-5" />
          </span>
          <div>
            <CardTitle>Không có quyền truy cập</CardTitle>
            <CardDescription className="mt-1">
              Chỉ ADMIN có quyền xem Audit Log.
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-6 motion-enter">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <History className="size-3.5" />
              Quản trị hệ thống
            </div>
            <h1 className="text-2xl font-semibold tracking-normal">
              Audit Logs
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Theo dõi các thay đổi quan trọng đối với dữ liệu hệ thống.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => auditLogsQuery.refetch()}
            disabled={auditLogsQuery.isFetching || dateRangeInvalid}
          >
            {auditLogsQuery.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Làm mới
          </Button>
        </section>

        <section className="grid overflow-hidden rounded-lg border bg-card shadow-sm sm:grid-cols-3">
          <div className="border-b px-5 py-4 sm:border-r sm:border-b-0">
            <p className="text-xs text-muted-foreground">Tổng bản ghi</p>
            <p className="mt-1 text-2xl font-semibold">
              {pagination?.totalItems ?? 0}
            </p>
          </div>
          <div className="border-b px-5 py-4 sm:border-r sm:border-b-0">
            <p className="text-xs text-muted-foreground">Đang hiển thị</p>
            <p className="mt-1 text-2xl font-semibold">{auditLogs.length}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground">Bản ghi mới nhất</p>
            <p className="mt-1 text-sm font-semibold">
              {formatAuditLogDate(auditLogs[0]?.createdAt)}
            </p>
          </div>
        </section>

        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-teal-800" />
                  Bộ lọc nhật ký
                </CardTitle>
                <CardDescription>
                  Kết quả được sắp xếp theo thời gian mới nhất.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                <FilterX className="size-4" />
                Xóa bộ lọc
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-0">
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="grid gap-2 lg:col-span-2">
                <Label htmlFor="audit-keyword">Tìm kiếm</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="audit-keyword"
                    value={keyword}
                    onChange={(event) => {
                      setKeyword(event.target.value);
                      resetPage();
                    }}
                    className="pl-9"
                    placeholder="Tìm trong mô tả thay đổi..."
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Module</Label>
                <Select
                  value={entityFilter}
                  onValueChange={(value) => {
                    setEntityFilter(value as EntityFilter);
                    resetPage();
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả module</SelectItem>
                    {auditLogEntityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Hành động</Label>
                <Select
                  value={actionFilter}
                  onValueChange={(value) => {
                    setActionFilter(value as ActionFilter);
                    resetPage();
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn hành động" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả hành động</SelectItem>
                    {auditLogActionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Người thực hiện</Label>
                <Select
                  value={actorFilter}
                  onValueChange={(value) => {
                    setActorFilter(value);
                    resetPage();
                  }}
                  disabled={usersQuery.isLoading || usersQuery.isError}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        usersQuery.isLoading
                          ? "Đang tải người dùng..."
                          : "Chọn người dùng"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả người dùng</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name} · {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {usersQuery.isError ? (
                  <p className="text-xs text-destructive">
                    Không thể tải danh sách người dùng.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="audit-resource-id">ID tài nguyên</Label>
                <Input
                  id="audit-resource-id"
                  type="number"
                  min={1}
                  step={1}
                  value={entityId}
                  onChange={(event) => {
                    setEntityId(event.target.value);
                    resetPage();
                  }}
                  placeholder="Ví dụ: 15"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="audit-from-date">Từ ngày</Label>
                <Input
                  id="audit-from-date"
                  type="date"
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    resetPage();
                  }}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="audit-to-date">Đến ngày</Label>
                <Input
                  id="audit-to-date"
                  type="date"
                  value={toDate}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    resetPage();
                  }}
                  aria-invalid={dateRangeInvalid}
                />
              </div>
            </div>

            {dateRangeInvalid ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
              </div>
            ) : null}
          </CardContent>
        </Card>

        {dateRangeInvalid ? null : auditLogsQuery.isLoading ? (
          <AuditLogsSkeleton />
        ) : auditLogsQuery.isError ? (
          <AuditLogsError
            error={auditLogsQuery.error}
            onRetry={() => auditLogsQuery.refetch()}
          />
        ) : auditLogs.length ? (
          <Card className="min-w-0 shadow-sm">
            <CardHeader className="border-b">
              <CardTitle>Danh sách Audit Log</CardTitle>
              <CardDescription>
                {pagination?.totalItems ?? auditLogs.length} bản ghi
                {auditLogsQuery.isFetching ? " · Đang cập nhật" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Người thực hiện</TableHead>
                    <TableHead>Hành động</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Tài nguyên</TableHead>
                    <TableHead>Mô tả</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">Chi tiết</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((auditLog, index) => {
                    const actionMeta = getAuditLogActionMeta(auditLog.action);

                    return (
                      <TableRow
                        key={auditLog.id}
                        className="motion-row"
                        style={{ "--motion-index": index } as CSSProperties}
                      >
                        <TableCell className="text-muted-foreground">
                          {formatAuditLogDate(auditLog.createdAt)}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">
                            {auditLog.actor?.name ?? "Hệ thống"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {auditLog.actor?.email ?? "Không còn tài khoản"}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "motion-badge",
                              actionMeta.className,
                            )}
                          >
                            {actionMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getAuditLogEntityLabel(auditLog.entity)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {auditLog.entityId ? `#${auditLog.entityId}` : "-"}
                        </TableCell>
                        <TableCell className="max-w-80 whitespace-normal">
                          <p className="line-clamp-2 leading-5">
                            {auditLog.description}
                          </p>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {auditLog.ipAddress || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Xem Audit Log #${auditLog.id}`}
                              title="Xem chi tiết"
                              onClick={() =>
                                setSelectedAuditLogId(auditLog.id)
                              }
                            >
                              <Eye className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="grid min-h-72 place-items-center px-5 text-center">
              <div className="max-w-sm">
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-800">
                  <Inbox className="size-5" />
                </span>
                <p className="mt-4 font-medium">
                  Chưa có Audit Log phù hợp
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Thử thay đổi bộ lọc hoặc làm mới để kiểm tra dữ liệu mới.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!dateRangeInvalid && !auditLogsQuery.isError ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Trang {currentPage} / {totalPages}
              </p>
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  resetPage();
                }}
              >
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / trang</SelectItem>
                  <SelectItem value="20">20 / trang</SelectItem>
                  <SelectItem value="50">50 / trang</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                disabled={
                  currentPage <= 1 ||
                  auditLogsQuery.isFetching ||
                  auditLogsQuery.isPlaceholderData
                }
              >
                <ChevronLeft className="size-4" />
                Trước
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((value) => value + 1)}
                disabled={
                  currentPage >= totalPages ||
                  auditLogsQuery.isFetching ||
                  auditLogsQuery.isPlaceholderData
                }
              >
                Sau
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <AuditLogDetailDrawer
        auditLogId={selectedAuditLogId}
        onClose={closeDetail}
      />
    </>
  );
}
