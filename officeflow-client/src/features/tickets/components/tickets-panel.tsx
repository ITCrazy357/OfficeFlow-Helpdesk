"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
} from "@/shared/components/ui/state-block";
import { useToast } from "@/shared/components/toast/toast-provider";
import { formatDate } from "@/shared/lib/format";
import { useAuth } from "@/features/auth/context/auth-context";
import type { AuthUser } from "@/features/auth/types";
import { ticketService } from "@/features/tickets/services/ticket-service";
import type { Pagination } from "@/shared/types/api";
import type { Ticket, TicketFilters } from "@/features/tickets/types";
import { TicketFiltersBar } from "@/features/tickets/components/ticket-filters";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/features/tickets/components/ticket-badges";

function canDeleteTicket(user: AuthUser | null, ticket: Ticket) {
  if (!user) {
    return false;
  }

  if (user.role === "ADMIN") {
    return true;
  }

  return (
    user.role === "EMPLOYEE" &&
    ticket.createdBy.id === user.id &&
    ticket.status === "OPEN"
  );
}

export function TicketsPanel() {
  const toast = useToast();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filters, setFilters] = useState<TicketFilters>({
    page: 1,
    limit: 10,
  });
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await ticketService.list(filters);
      setTickets(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ticket");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTickets();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadTickets]);

  const handleDelete = async (ticket: Ticket) => {
    const confirmed = window.confirm(`Xóa ticket "${ticket.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await ticketService.delete(ticket.id);
      toast.success("Xóa ticket thành công");
      await loadTickets();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Xóa ticket thất bại";
      toast.error(message);
    }
  };

  return (
    <div className="grid gap-5">
      <TicketFiltersBar filters={filters} onChange={setFilters} />

      {isLoading ? <LoadingBlock title="Đang tải ticket" /> : null}

      {!isLoading && error ? (
        <ErrorBlock
          title="Không tải được ticket"
          message={error}
          action={
            <Button variant="secondary" onClick={() => void loadTickets()}>
              Thử lại
            </Button>
          }
        />
      ) : null}

      {!isLoading && !error && tickets.length === 0 ? (
        <EmptyBlock
          title="Chưa có ticket"
          message="Không có ticket nào phù hợp với điều kiện hiện tại."
          action={
            <Link href="/tickets/new">
              <Button icon={<Plus className="h-4 w-4" />}>Tạo ticket</Button>
            </Link>
          }
        />
      ) : null}

      {!isLoading && !error && tickets.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03]">
          <div className="flex flex-col gap-3 border-b border-zinc-200/80 bg-zinc-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-950">
                Danh sách ticket
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {pagination?.totalItems ?? tickets.length} ticket
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1.5fr_0.9fr_0.8fr_1fr_0.7fr] gap-4 border-b border-zinc-200 bg-zinc-950 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-300 max-lg:hidden">
            <span>Ticket</span>
            <span>Trạng thái</span>
            <span>Ưu tiên</span>
            <span>Người tạo</span>
            <span></span>
          </div>

          {tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="group grid gap-4 border-b border-zinc-100 px-4 py-4 transition last:border-0 hover:bg-teal-50/30 lg:grid-cols-[1.5fr_0.9fr_0.8fr_1fr_0.7fr] lg:items-center"
            >
              <div className="min-w-0">
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="text-base font-semibold tracking-[-0.01em] text-zinc-950 transition group-hover:text-teal-800"
                >
                  {ticket.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600">
                  {ticket.description}
                </p>
                <p className="mt-2 text-xs font-medium text-zinc-500">
                  #{ticket.id} - {formatDate(ticket.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="min-w-20 text-xs font-semibold text-zinc-500 lg:hidden">
                  Trạng thái
                </span>
                <TicketStatusBadge status={ticket.status} />
              </div>

              <div className="flex items-center gap-2">
                <span className="min-w-20 text-xs font-semibold text-zinc-500 lg:hidden">
                  Ưu tiên
                </span>
                <TicketPriorityBadge priority={ticket.priority} />
              </div>

              <div className="min-w-0 text-sm">
                <p className="mb-1 text-xs font-semibold text-zinc-500 lg:hidden">
                  Người tạo
                </p>
                <p className="truncate font-semibold text-zinc-900">
                  {ticket.createdBy.name}
                </p>
                <p className="truncate text-zinc-600">
                  {ticket.createdBy.email}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link href={`/tickets/${ticket.id}`}>
                  <Button
                    variant="secondary"
                    className="px-3"
                    icon={<Eye className="h-4 w-4" />}
                  >
                    Xem
                  </Button>
                </Link>
                {canDeleteTicket(user, ticket) ? (
                  <Button
                    variant="danger"
                    className="px-3"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => void handleDelete(ticket)}
                  >
                    Xóa
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-zinc-600">
            Trang {pagination.page}/{pagination.totalPages} -{" "}
            {pagination.totalItems} ticket
          </p>
          <div className="grid gap-2 sm:flex">
            <Button
              variant="secondary"
              disabled={pagination.page <= 1}
              icon={<ChevronLeft className="h-4 w-4" />}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: Math.max(1, pagination.page - 1),
                }))
              }
            >
              Trước
            </Button>
            <Button
              variant="secondary"
              disabled={pagination.page >= pagination.totalPages}
              icon={<ChevronRight className="h-4 w-4" />}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  page: pagination.page + 1,
                }))
              }
            >
              Sau
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
