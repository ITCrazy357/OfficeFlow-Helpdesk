"use client";

import { AlertCircle, ArrowRight, Clock, Inbox, TicketCheck } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTickets } from "@/features/tickets/hooks";
import type { TicketStatus } from "@/features/tickets/types";
import { getApiErrorMessage } from "@/lib/axios";

const statusLabels: Record<TicketStatus, string> = {
  OPEN: "Mở",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
};

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <div className="h-8 w-48 rounded-full bg-muted motion-shimmer" />
        <div className="h-4 w-72 rounded-full bg-muted motion-shimmer" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card key={item}>
            <CardContent className="grid gap-3 pt-0">
              <div className="h-4 w-24 rounded-full bg-muted motion-shimmer" />
              <div className="h-8 w-16 rounded-full bg-muted motion-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, error, isError, isLoading } = useTickets({
    page: 1,
    limit: 5,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <Card>
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

  const latestTickets = data?.data ?? [];
  const pagination = data?.pagination;
  const openLatestCount = latestTickets.filter(
    (ticket) => ticket.status === "OPEN",
  ).length;
  const inProgressLatestCount = latestTickets.filter(
    (ticket) => ticket.status === "IN_PROGRESS",
  ).length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tổng quan nhanh các ticket trong hệ thống.
          </p>
        </div>
        <Button asChild>
          <Link href="/tickets">
            Xem tickets
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Tổng tickets</CardDescription>
            <CardTitle className="text-3xl">
              {pagination?.totalItems ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Đang mở trong 5 ticket mới</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              {openLatestCount}
              <Inbox className="size-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Đang xử lý trong 5 ticket mới</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              {inProgressLatestCount}
              <Clock className="size-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card>
        <CardHeader className="border-b">
          <div>
            <CardTitle>Ticket mới nhất</CardTitle>
            <CardDescription>5 ticket gần đây nhất theo backend.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {latestTickets.length > 0 ? (
            <div className="divide-y">
              {latestTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <TicketCheck className="size-4 shrink-0 text-muted-foreground" />
                      <p className="truncate text-sm font-medium">
                        #{ticket.id} {ticket.title}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Người tạo: {ticket.createdBy?.name ?? "-"}
                    </p>
                  </div>
                  <Badge variant="outline">{statusLabels[ticket.status]}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Chưa có ticket nào.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
