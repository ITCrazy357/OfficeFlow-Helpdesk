"use client";

import { AlertCircle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTickets } from "@/features/tickets/hooks";
import type {
  Ticket,
  TicketPriority,
  TicketStatus,
} from "@/features/tickets/types";
import { getApiErrorMessage } from "@/lib/axios";

const PAGE_SIZE = 10;

const statusMeta: Record<TicketStatus, { label: string; className: string }> = {
  OPEN: {
    label: "Mở",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  RESOLVED: {
    label: "Đã xử lý",
    className: "border-teal-200 bg-teal-50 text-teal-700",
  },
  CLOSED: {
    label: "Đã đóng",
    className: "border-zinc-200 bg-zinc-50 text-zinc-700",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

const priorityMeta: Record<
  TicketPriority,
  { label: string; className: string }
> = {
  LOW: {
    label: "Thấp",
    className: "border-zinc-200 bg-zinc-50 text-zinc-700",
  },
  MEDIUM: {
    label: "Trung bình",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  HIGH: {
    label: "Cao",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  URGENT: {
    label: "Khẩn cấp",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const meta = statusMeta[status];

  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const meta = priorityMeta[priority];

  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

function TicketsTable({ tickets }: { tickets: Ticket[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">ID</TableHead>
          <TableHead>Tiêu đề</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Ưu tiên</TableHead>
          <TableHead>Người tạo</TableHead>
          <TableHead>Người xử lý</TableHead>
          <TableHead>Danh mục</TableHead>
          <TableHead>Ngày tạo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell className="font-medium">#{ticket.id}</TableCell>
            <TableCell className="min-w-64 max-w-sm whitespace-normal">
              <div className="font-medium">{ticket.title}</div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {ticket.description}
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge status={ticket.status} />
            </TableCell>
            <TableCell>
              <PriorityBadge priority={ticket.priority} />
            </TableCell>
            <TableCell>{ticket.createdBy?.name ?? "-"}</TableCell>
            <TableCell>{ticket.assignedTo?.name ?? "-"}</TableCell>
            <TableCell>{ticket.category?.name ?? "-"}</TableCell>
            <TableCell>{formatDateTime(ticket.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TicketsSkeleton() {
  return (
    <Card>
      <CardContent className="grid gap-3 pt-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[80px_1fr_120px] gap-4 rounded-lg border p-3"
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

export default function TicketsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");

  const { data, error, isError, isFetching, isLoading, refetch } = useTickets({
    page,
    limit: PAGE_SIZE,
    keyword: keyword || undefined,
  });

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setKeyword(searchInput.trim());
  }

  function handleClearSearch() {
    setSearchInput("");
    setKeyword("");
    setPage(1);
  }

  const tickets = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);
  const currentPage = pagination?.page ?? page;
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý yêu cầu hỗ trợ nội bộ.
          </p>
        </div>

        <form
          className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-96 sm:flex-row"
          onSubmit={handleSearch}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-8"
              placeholder="Tìm theo tiêu đề hoặc mô tả"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isFetching}>
              Tìm kiếm
            </Button>
            {keyword ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearSearch}
                disabled={isFetching}
              >
                Xóa
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      {isLoading ? (
        <TicketsSkeleton />
      ) : isError ? (
        <Card>
          <CardContent className="flex items-start gap-3 pt-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <div className="grid gap-3">
              <div>
                <CardTitle>Không thể tải danh sách tickets</CardTitle>
                <CardDescription className="mt-1">
                  {getApiErrorMessage(error, "Không thể tải danh sách tickets.")}
                </CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => refetch()}>
                Thử lại
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b">
            <div>
              <CardTitle>Danh sách tickets</CardTitle>
              <CardDescription>
                {pagination
                  ? `${pagination.totalItems} ticket`
                  : "Không có dữ liệu phân trang"}
                {isFetching ? " - Đang cập nhật" : ""}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {tickets.length > 0 ? (
              <TicketsTable tickets={tickets} />
            ) : (
              <div className="grid min-h-64 place-items-center text-center">
                <div>
                  <p className="font-medium">Chưa có ticket phù hợp</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Thử đổi từ khóa tìm kiếm hoặc kiểm tra lại dữ liệu backend.
                  </p>
                </div>
              </div>
            )}
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
            disabled={!canGoPrevious || isFetching}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((value) => value + 1)}
            disabled={!canGoNext || isFetching}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
