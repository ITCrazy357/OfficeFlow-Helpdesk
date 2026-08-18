"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ClipboardCheck,
  LockKeyhole,
  Plus,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { useMe } from "@/features/auth/hooks";
import {
  LeaveRequestList,
  LeaveRequestsSkeleton,
} from "@/features/leave-requests/components/leave-request-list";
import { leaveRequestStatusOptions } from "@/features/leave-requests/constants";
import {
  useMyLeaveRequests,
  usePendingLeaveRequests,
} from "@/features/leave-requests/hooks";
import type {
  GetLeaveRequestsParams,
  LeaveRequestStatus,
} from "@/features/leave-requests/types";
import { getLeaveRequestErrorMessage } from "@/features/leave-requests/constants";

const PAGE_SIZE = 10;

type LeaveRequestScope = "mine" | "pending";
type StatusFilter = "ALL" | LeaveRequestStatus;

export default function LeaveRequestsPage() {
  const { data: user } = useMe();
  const [selectedScope, setSelectedScope] =
    useState<LeaveRequestScope>("mine");
  const [minePage, setMinePage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const canReview = user?.role === "MANAGER" || user?.role === "ADMIN";
  const scope = canReview ? selectedScope : "mine";
  const mineParams = useMemo<GetLeaveRequestsParams>(
    () => ({
      page: minePage,
      limit: PAGE_SIZE,
      status: statusFilter === "ALL" ? undefined : statusFilter,
    }),
    [minePage, statusFilter],
  );
  const pendingParams = useMemo(
    () => ({ page: pendingPage, limit: PAGE_SIZE }),
    [pendingPage],
  );
  const mineQuery = useMyLeaveRequests(
    mineParams,
    Boolean(user) && scope === "mine",
  );
  const pendingQuery = usePendingLeaveRequests(
    pendingParams,
    Boolean(user) && canReview && scope === "pending",
  );
  const activeQuery = scope === "pending" ? pendingQuery : mineQuery;
  const activePage = scope === "pending" ? pendingPage : minePage;

  function handleScopeChange(nextScope: LeaveRequestScope) {
    setSelectedScope(nextScope);

    if (nextScope === "mine") {
      setMinePage(1);
    } else {
      setPendingPage(1);
    }
  }

  return (
    <div className="grid gap-6 motion-enter">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <CalendarDays className="size-3.5" />
            Nghỉ phép
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Đơn nghỉ phép
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi đơn của bạn và xử lý đúng các đơn được giao duyệt.
          </p>
        </div>

        <Button asChild className="bg-teal-950 hover:bg-teal-900">
          <Link href="/leave-requests/new">
            <Plus className="size-4" />
            Tạo đơn nghỉ
          </Link>
        </Button>
      </section>

      <Card className="shadow-sm motion-panel">
        <CardContent className="grid gap-4 pt-0">
          <div
            className="grid gap-2 sm:grid-cols-2"
            role="tablist"
            aria-label="Phạm vi đơn nghỉ phép"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === "mine"}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                scope === "mine"
                  ? "border-teal-800 bg-teal-950 text-white shadow-sm"
                  : "bg-card text-muted-foreground hover:border-teal-200 hover:bg-teal-50 hover:text-teal-950",
              )}
              onClick={() => handleScopeChange("mine")}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-current/10">
                <UserRound className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">Đơn của tôi</span>
                <span className="mt-0.5 block text-xs opacity-75">
                  Các đơn do chính bạn gửi
                </span>
              </span>
            </button>

            {canReview ? (
              <button
                type="button"
                role="tab"
                aria-selected={scope === "pending"}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                  scope === "pending"
                    ? "border-teal-800 bg-teal-950 text-white shadow-sm"
                    : "bg-card text-muted-foreground hover:border-teal-200 hover:bg-teal-50 hover:text-teal-950",
                )}
                onClick={() => handleScopeChange("pending")}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-current/10">
                  <ClipboardCheck className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    Chờ tôi duyệt
                  </span>
                  <span className="mt-0.5 block text-xs opacity-75">
                    Chỉ các đơn giao trực tiếp cho bạn
                  </span>
                </span>
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            {scope === "mine" ? (
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as StatusFilter);
                  setMinePage(1);
                }}
              >
                <SelectTrigger
                  className="w-full sm:w-56"
                  aria-label="Lọc theo trạng thái"
                >
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                  {leaveRequestStatusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium text-foreground">
                Danh sách đang chờ quyết định của bạn
              </p>
            )}

            {canReview ? (
              <p className="flex max-w-xl items-start gap-2 text-xs leading-5 text-muted-foreground">
                <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Vai trò Admin không cho phép xem toàn bộ lý do nghỉ. Bạn chỉ
                  thấy đơn được giao trực tiếp để duyệt.
                </span>
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {activeQuery.isLoading ? (
        <LeaveRequestsSkeleton />
      ) : activeQuery.isError ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-start gap-3 pt-0">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <div className="grid gap-3">
              <div>
                <CardTitle>Không thể tải đơn nghỉ phép</CardTitle>
                <CardDescription className="mt-1">
                  {getLeaveRequestErrorMessage(
                    activeQuery.error,
                    "Không thể tải danh sách đơn nghỉ phép.",
                  )}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => activeQuery.refetch()}
              >
                Thử lại
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <LeaveRequestList
          leaveRequests={activeQuery.data?.items ?? []}
          pagination={activeQuery.data?.pagination}
          scope={scope}
          page={activePage}
          isFetching={activeQuery.isFetching}
          hasFilter={scope === "mine" && statusFilter !== "ALL"}
          onPageChange={scope === "pending" ? setPendingPage : setMinePage}
        />
      )}
    </div>
  );
}
