import type { CSSProperties } from "react";
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Pagination } from "@/types/api";
import {
  formatLeaveDate,
  formatLeaveDateTime,
  getLeaveDayCount,
} from "../constants";
import type { LeaveRequest } from "../types";
import { LeaveRequestStatusBadge } from "./leave-request-status-badge";

type LeaveRequestListScope = "mine" | "pending";

type LeaveRequestListProps = {
  leaveRequests: LeaveRequest[];
  pagination?: Pagination;
  scope: LeaveRequestListScope;
  page: number;
  isFetching: boolean;
  hasFilter?: boolean;
  onPageChange: (page: number) => void;
};

function LeavePeriod({ leaveRequest }: { leaveRequest: LeaveRequest }) {
  const dayCount = getLeaveDayCount(
    leaveRequest.startDate,
    leaveRequest.endDate,
  );

  return (
    <div className="min-w-44">
      <p className="font-medium">
        {formatLeaveDate(leaveRequest.startDate)} - {formatLeaveDate(leaveRequest.endDate)}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock3 className="size-3" />
        {dayCount} ngày theo lịch
      </p>
    </div>
  );
}

function LeaveRequestsTable({
  leaveRequests,
  scope,
}: {
  leaveRequests: LeaveRequest[];
  scope: LeaveRequestListScope;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">ID</TableHead>
          <TableHead>Kỳ nghỉ</TableHead>
          <TableHead>Lý do</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>{scope === "mine" ? "Người duyệt" : "Nhân viên"}</TableHead>
          <TableHead>Ngày gửi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leaveRequests.map((leaveRequest, index) => (
          <TableRow
            key={leaveRequest.id}
            className="motion-row"
            style={{ "--motion-index": index } as CSSProperties}
          >
            <TableCell className="font-medium">#{leaveRequest.id}</TableCell>
            <TableCell>
              <LeavePeriod leaveRequest={leaveRequest} />
            </TableCell>
            <TableCell className="min-w-72 max-w-md whitespace-normal">
              <Link
                href={`/leave-requests/${leaveRequest.id}`}
                className="line-clamp-2 font-medium leading-6 text-foreground hover:text-teal-800"
              >
                {leaveRequest.reason}
              </Link>
            </TableCell>
            <TableCell>
              <LeaveRequestStatusBadge status={leaveRequest.status} />
            </TableCell>
            <TableCell>
              {scope === "mine"
                ? leaveRequest.approver.name
                : leaveRequest.requester.name}
            </TableCell>
            <TableCell>{formatLeaveDateTime(leaveRequest.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LeaveRequestsMobileList({
  leaveRequests,
  scope,
}: {
  leaveRequests: LeaveRequest[];
  scope: LeaveRequestListScope;
}) {
  return (
    <div className="grid gap-3 md:hidden">
      {leaveRequests.map((leaveRequest, index) => (
        <Link
          key={leaveRequest.id}
          href={`/leave-requests/${leaveRequest.id}`}
          className="motion-card rounded-xl border bg-card p-4 shadow-sm"
          style={{ "--motion-index": index } as CSSProperties}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Đơn #{leaveRequest.id}
              </p>
              <p className="mt-1 font-semibold">
                {formatLeaveDate(leaveRequest.startDate)} - {formatLeaveDate(leaveRequest.endDate)}
              </p>
            </div>
            <LeaveRequestStatusBadge status={leaveRequest.status} />
          </div>

          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {leaveRequest.reason}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <UserRoundCheck className="size-3.5" />
              {scope === "mine"
                ? `Duyệt bởi ${leaveRequest.approver.name}`
                : leaveRequest.requester.name}
            </span>
            <span>
              {getLeaveDayCount(leaveRequest.startDate, leaveRequest.endDate)} ngày
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function LeaveRequestsSkeleton() {
  return (
    <Card>
      <CardContent className="grid gap-3 pt-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[80px_1fr_120px] gap-4 rounded-xl border p-3"
          >
            <div className="h-4 rounded-full bg-muted motion-shimmer" />
            <div className="h-4 rounded-full bg-muted motion-shimmer" />
            <div className="h-4 rounded-full bg-muted motion-shimmer" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function LeaveRequestList({
  leaveRequests,
  pagination,
  scope,
  page,
  isFetching,
  hasFilter = false,
  onPageChange,
}: LeaveRequestListProps) {
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);
  const currentPage = pagination?.page ?? page;
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="grid gap-4">
      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>
            {scope === "mine" ? "Đơn của tôi" : "Đơn chờ tôi duyệt"}
          </CardTitle>
          <CardDescription>
            {pagination ? `${pagination.totalItems} đơn nghỉ phép` : "Chưa có dữ liệu"}
            {isFetching ? " / Đang cập nhật" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {leaveRequests.length ? (
            <>
              <div className="hidden md:block">
                <LeaveRequestsTable
                  leaveRequests={leaveRequests}
                  scope={scope}
                />
              </div>
              <LeaveRequestsMobileList
                leaveRequests={leaveRequests}
                scope={scope}
              />
            </>
          ) : (
            <div className="grid min-h-72 place-items-center px-4 text-center">
              <div className="max-w-md">
                <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-800">
                  <CalendarOff className="size-5" />
                </div>
                <p className="font-medium">
                  {scope === "pending"
                    ? "Không có đơn nào đang chờ bạn duyệt"
                    : hasFilter
                      ? "Không có đơn phù hợp với bộ lọc"
                      : "Bạn chưa có đơn nghỉ phép"}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {scope === "pending"
                    ? "Khi một nhân viên được phân công cho bạn gửi đơn, đơn sẽ xuất hiện tại đây."
                    : hasFilter
                      ? "Hãy đổi trạng thái lọc để xem các đơn khác."
                      : "Tạo đơn mới khi bạn cần gửi lịch nghỉ tới quản lý trực tiếp."}
                </p>
                {scope === "mine" && !hasFilter ? (
                  <Button asChild className="mt-4">
                    <Link href="/leave-requests/new">
                      <Plus className="size-4" />
                      Tạo đơn nghỉ
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Trang {currentPage} / {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            disabled={!canGoPrevious || isFetching}
          >
            <ChevronLeft className="size-4" />
            Trước
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext || isFetching}
          >
            Sau
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
