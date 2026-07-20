"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Inbox,
  Plus,
  Search,
  SlidersHorizontal,
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
import { Input } from "@/components/ui/input";
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
import {
  TicketPriorityBadge,
  TicketSlaBadge,
  TicketStatusBadge,
} from "@/features/tickets/components/ticket-badges";
import {
  getTicketDueAt,
  ticketSlaOptions,
  ticketPriorityOptions,
  ticketStatusOptions,
} from "@/features/tickets/constants";
import { useTickets } from "@/features/tickets/hooks";
import type {
  GetTicketsParams,
  Ticket,
  TicketPriority,
  TicketStatus,
} from "@/features/tickets/types";
import { getApiErrorMessage } from "@/lib/axios";

const PAGE_SIZE = 10;

type StatusFilter = "ALL" | TicketStatus;
type PriorityFilter = "ALL" | TicketPriority;
type SlaFilter = "ALL" | "ON_TRACK" | "OVERDUE";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
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
          <TableHead>Hạn xử lý</TableHead>
          <TableHead>Ngày tạo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket, index) => (
          <TableRow
            key={ticket.id}
            className="motion-row"
            style={{ "--motion-index": index } as CSSProperties}
          >
            <TableCell className="font-medium">#{ticket.id}</TableCell>
            <TableCell className="min-w-72 max-w-sm whitespace-normal">
              <Link
                href={`/tickets/${ticket.id}`}
                className="font-semibold text-foreground hover:text-teal-800"
              >
                {ticket.title}
              </Link>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {ticket.description}
              </div>
            </TableCell>
            <TableCell>
              <TicketStatusBadge status={ticket.status} />
            </TableCell>
            <TableCell>
              <TicketPriorityBadge priority={ticket.priority} />
            </TableCell>
            <TableCell>{ticket.createdBy?.name ?? "-"}</TableCell>
            <TableCell>{ticket.assignedTo?.name ?? "-"}</TableCell>
            <TableCell>{ticket.category?.name ?? "-"}</TableCell>
            <TableCell className="min-w-40">
              <div className="grid gap-1">
                <TicketSlaBadge ticket={ticket} />
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(getTicketDueAt(ticket))}
                </span>
              </div>
            </TableCell>
            <TableCell>{formatDateTime(ticket.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TicketsMobileList({ tickets }: { tickets: Ticket[] }) {
  return (
    <div className="grid gap-3 md:hidden">
      {tickets.map((ticket, index) => (
        <Link
          key={ticket.id}
          href={`/tickets/${ticket.id}`}
          className="motion-card rounded-xl border bg-card p-4 shadow-sm"
          style={{ "--motion-index": index } as CSSProperties}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                #{ticket.id}
              </p>
              <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">
                {ticket.title}
              </h3>
            </div>
            <TicketStatusBadge status={ticket.status} />
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {ticket.description}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TicketPriorityBadge priority={ticket.priority} />
            <TicketSlaBadge ticket={ticket} />
            <span className="text-xs text-muted-foreground">
              Hạn: {formatDateTime(getTicketDueAt(ticket))}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function TicketsSkeleton() {
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

export default function TicketsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>("ALL");
  const [slaFilter, setSlaFilter] = useState<SlaFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");

  const params = useMemo<GetTicketsParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      keyword: keyword || undefined,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      priority: priorityFilter === "ALL" ? undefined : priorityFilter,
      isOverdue:
        slaFilter === "ALL" ? undefined : slaFilter === "OVERDUE",
      categoryId:
        categoryFilter.trim() === "" ? undefined : Number(categoryFilter),
    }),
    [categoryFilter, keyword, page, priorityFilter, slaFilter, statusFilter],
  );

  const { data, error, isError, isFetching, isLoading, refetch } =
    useTickets(params);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setKeyword(searchInput.trim());
  }

  function handleClearFilters() {
    setSearchInput("");
    setKeyword("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setSlaFilter("ALL");
    setCategoryFilter("");
    setPage(1);
  }

  const tickets = data?.items ?? [];
  const pagination = data?.pagination;
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);
  const currentPage = pagination?.page ?? page;
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;
  const hasActiveFilter =
    Boolean(keyword) ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    slaFilter !== "ALL" ||
    categoryFilter.trim() !== "";

  return (
    <div className="grid gap-6 motion-enter">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Filter className="size-3.5" />
            Không gian ticket
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">Tickets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý yêu cầu hỗ trợ theo quyền, trạng thái, độ ưu tiên và hạn SLA.
          </p>
        </div>

        <Button asChild className="bg-teal-950 hover:bg-teal-900">
          <Link href="/tickets/new">
            <Plus className="size-4" />
            Tạo ticket
          </Link>
        </Button>
      </section>

      <Card className="shadow-sm motion-panel">
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <div>
              <CardTitle>Bộ lọc</CardTitle>
              <CardDescription>
                Lọc theo từ khóa, trạng thái, độ ưu tiên, SLA và danh mục ID.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <form
            className="grid gap-3 xl:grid-cols-[1fr_170px_170px_150px_150px_auto]"
            onSubmit={handleSearch}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="pl-8"
                placeholder="Tìm theo tiêu đề hoặc mô tả"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as StatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                {ticketStatusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter}
              onValueChange={(value) => {
                setPriorityFilter(value as PriorityFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Ưu tiên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả ưu tiên</SelectItem>
                {ticketPriorityOptions.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              min={1}
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Danh mục ID"
            />

            <Select
              value={slaFilter}
              onValueChange={(value) => {
                setSlaFilter(value as SlaFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <Clock3 className="size-4 text-muted-foreground" />
                <SelectValue placeholder="SLA" />
              </SelectTrigger>
              <SelectContent>
                {ticketSlaOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button type="submit" disabled={isFetching}>
                Tìm
              </Button>
              {hasActiveFilter ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearFilters}
                  disabled={isFetching}
                >
                  Xóa
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <TicketsSkeleton />
      ) : isError ? (
        <Card className="border-destructive/20 bg-destructive/5">
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
        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Danh sách tickets</CardTitle>
                <CardDescription>
                  {pagination
                    ? `${pagination.totalItems} ticket`
                    : "Không có dữ liệu phân trang"}
                  {isFetching ? " / Đang cập nhật" : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {tickets.length > 0 ? (
              <>
                <div className="hidden md:block">
                  <TicketsTable tickets={tickets} />
                </div>
                <TicketsMobileList tickets={tickets} />
              </>
            ) : (
              <div className="grid min-h-72 place-items-center px-4 text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-800">
                    <Inbox className="size-5" />
                  </div>
                  <p className="font-medium">Chưa có ticket phù hợp</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Thử đổi bộ lọc hoặc tạo ticket mới để bắt đầu luồng hỗ trợ.
                  </p>
                  <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                    {hasActiveFilter ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClearFilters}
                      >
                        Xóa bộ lọc
                      </Button>
                    ) : null}
                    <Button asChild>
                      <Link href="/tickets/new">
                        <Plus className="size-4" />
                        Tạo ticket
                      </Link>
                    </Button>
                  </div>
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
            Trước
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage((value) => value + 1)}
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
