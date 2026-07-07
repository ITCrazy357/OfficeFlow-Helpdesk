"use client";

import {
  AlertCircle,
  ArrowRight,
  Clock,
  Inbox,
  Plus,
  ShieldCheck,
  TicketCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TicketStatusBadge } from "@/features/tickets/components/ticket-badges";
import { useTickets } from "@/features/tickets/hooks";
import { getApiErrorMessage } from "@/lib/axios";

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <div className="h-9 w-56 rounded-full bg-muted motion-shimmer" />
        <div className="h-4 w-80 max-w-full rounded-full bg-muted motion-shimmer" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="motion-panel">
            <CardContent className="grid gap-3 pt-0">
              <div className="h-4 w-24 rounded-full bg-muted motion-shimmer" />
              <div className="h-9 w-16 rounded-full bg-muted motion-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="grid gap-3 pt-0">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-14 rounded-xl bg-muted motion-shimmer"
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorCard({ error }: { error: unknown }) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardContent className="flex items-start gap-3 pt-0">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <div>
          <CardTitle>Không thể tải dashboard</CardTitle>
          <CardDescription className="mt-1">
            {getApiErrorMessage(error, "Không thể tải dữ liệu dashboard.")}
          </CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const latestQuery = useTickets({ page: 1, limit: 5 });
  const totalQuery = useTickets({ page: 1, limit: 1 });
  const openQuery = useTickets({ page: 1, limit: 1, status: "OPEN" });
  const progressQuery = useTickets({
    page: 1,
    limit: 1,
    status: "IN_PROGRESS",
  });
  const resolvedQuery = useTickets({ page: 1, limit: 1, status: "RESOLVED" });

  const queries = [
    latestQuery,
    totalQuery,
    openQuery,
    progressQuery,
    resolvedQuery,
  ];

  if (queries.some((query) => query.isLoading)) {
    return <DashboardSkeleton />;
  }

  const failedQuery = queries.find((query) => query.isError);

  if (failedQuery) {
    return <ErrorCard error={failedQuery.error} />;
  }

  const latestTickets = latestQuery.data?.data ?? [];
  const total = totalQuery.data?.pagination.totalItems ?? 0;
  const open = openQuery.data?.pagination.totalItems ?? 0;
  const inProgress = progressQuery.data?.pagination.totalItems ?? 0;
  const resolved = resolvedQuery.data?.pagination.totalItems ?? 0;

  const statCards = [
    {
      label: "Tổng tickets",
      value: total,
      icon: TicketCheck,
      detail: "Theo quyền của tài khoản hiện tại",
    },
    {
      label: "Đang mở",
      value: open,
      icon: Inbox,
      detail: "Cần tiếp nhận hoặc phân loại",
    },
    {
      label: "Đang xử lý",
      value: inProgress,
      icon: Clock,
      detail: "Đang trong luồng hỗ trợ",
    },
    {
      label: "Đã xử lý",
      value: resolved,
      icon: ShieldCheck,
      detail: "Chờ đóng hoặc xác nhận",
    },
  ];

  return (
    <div className="grid gap-6 motion-enter">
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto] md:items-end md:p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <TrendingUp className="size-3.5" />
              Tổng quan vận hành
            </div>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Theo dõi sức khỏe luồng hỗ trợ, số lượng ticket theo trạng thái
              và các yêu cầu mới nhất từ backend OfficeFlow.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/tickets">
                Xem tickets
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild className="bg-teal-950 hover:bg-teal-900">
              <Link href="/tickets/new">
                <Plus className="size-4" />
                Tạo ticket
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;

          return (
            <Card
              key={card.label}
              className="motion-card border-white/80 bg-card/95 shadow-sm shadow-slate-200/60"
              style={{ "--motion-index": index } as CSSProperties}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardDescription>{card.label}</CardDescription>
                    <CardTitle className="mt-2 text-3xl font-semibold">
                      {card.value}
                    </CardTitle>
                  </div>
                  <div className="grid size-10 place-items-center rounded-xl bg-teal-950/5 text-teal-950">
                    <Icon className="size-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs leading-5 text-muted-foreground">
                  {card.detail}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Ticket mới nhất</CardTitle>
              <CardDescription>
                5 ticket gần đây nhất theo dữ liệu backend.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/tickets">Mở danh sách</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {latestTickets.length > 0 ? (
            <div className="divide-y">
              {latestTickets.map((ticket, index) => (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="motion-row flex flex-col gap-3 py-4 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  style={{ "--motion-index": index } as CSSProperties}
                >
                  <div className="min-w-0 px-1">
                    <div className="flex items-center gap-2">
                      <TicketCheck className="size-4 shrink-0 text-muted-foreground" />
                      <p className="truncate text-sm font-semibold">
                        #{ticket.id} {ticket.title}
                      </p>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      Người tạo: {ticket.createdBy?.name ?? "-"} / Ưu tiên:{" "}
                      {ticket.priority}
                    </p>
                  </div>
                  <div className="px-1">
                    <TicketStatusBadge status={ticket.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center text-center">
              <div>
                <p className="font-medium">Chưa có ticket nào</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tạo ticket đầu tiên để bắt đầu theo dõi luồng hỗ trợ.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
