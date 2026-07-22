"use client";

import type { CSSProperties } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  FilePlus2,
  Inbox,
  Layers3,
  PieChart,
  Plus,
  Server,
  ShieldCheck,
  TicketCheck,
  TrendingUp,
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
  TicketPriorityBadge,
  TicketSlaBadge,
  TicketStatusBadge,
} from "@/features/tickets/components/ticket-badges";
import { getPriorityMeta, getStatusMeta } from "@/features/tickets/constants";
import {
  useDashboardSlaOverview,
  useDashboardSummary,
  useTicketsByCategoryReport,
  useTicketsByDepartmentReport,
  useTicketsByPriorityReport,
  useTicketsByStatusReport,
} from "@/features/dashboard/hooks";
import { useDbHealth, useHealth } from "@/features/system/hooks";
import { useTickets } from "@/features/tickets/hooks";
import type { TicketPriority, TicketStatus } from "@/features/tickets/types";
import { getApiErrorMessage } from "@/lib/axios";

const statusBarColors: Record<TicketStatus, string> = {
  OPEN: "bg-teal-600",
  IN_PROGRESS: "bg-sky-600",
  RESOLVED: "bg-emerald-600",
  CLOSED: "bg-slate-500",
  CANCELLED: "bg-red-600",
};

const priorityBarColors: Record<TicketPriority, string> = {
  LOW: "bg-slate-500",
  MEDIUM: "bg-blue-600",
  HIGH: "bg-amber-600",
  URGENT: "bg-red-600",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function getPercent(value: number, total: number) {
  return total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <div className="h-9 w-56 rounded-full bg-muted motion-shimmer" />
        <div className="h-4 w-80 max-w-full rounded-full bg-muted motion-shimmer" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="motion-panel">
            <CardContent className="grid gap-3 pt-0">
              <div className="h-4 w-24 rounded-full bg-muted motion-shimmer" />
              <div className="h-9 w-16 rounded-full bg-muted motion-shimmer" />
              <div className="h-3 w-36 rounded-full bg-muted motion-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-80 rounded-xl bg-muted motion-shimmer" />
        <div className="h-80 rounded-xl bg-muted motion-shimmer" />
      </div>
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
          <CardTitle>Không thể tải dashboard report</CardTitle>
          <CardDescription className="mt-1">
            {getApiErrorMessage(error, "Không thể tải dữ liệu dashboard.")}
          </CardDescription>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  index,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof TicketCheck;
  tone: "teal" | "sky" | "emerald" | "amber" | "red" | "slate";
  index: number;
}) {
  const tones = {
    teal: "bg-teal-950/5 text-teal-950",
    sky: "bg-sky-950/5 text-sky-900",
    emerald: "bg-emerald-950/5 text-emerald-900",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <Card
      className="motion-card shadow-sm transition-colors hover:bg-muted/20"
      style={{ "--motion-index": index } as CSSProperties}
    >
      <CardContent className="pt-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-2 text-3xl font-semibold">
              {value}
            </CardTitle>
          </div>
          <div className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}>
            <Icon className="size-5" />
          </div>
        </div>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}

function ReportBarList({
  title,
  description,
  icon: Icon,
  rows,
  emptyText,
}: {
  title: string;
  description: string;
  icon: typeof BarChart3;
  rows: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  emptyText: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length > 0 ? (
          <div className="grid gap-4">
            {rows.map((row, index) => {
              const percent = getPercent(row.value, total);

              return (
                <div
                  key={row.label}
                  className="motion-row grid gap-2"
                  style={{ "--motion-index": index } as CSSProperties}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground">
                      {formatNumber(row.value)} / {formatPercent(percent)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${row.color}`}
                      style={{ width: `${Math.max(percent, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center rounded-lg border border-dashed p-6 text-center">
            <div>
              <Icon className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">{emptyText}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Dữ liệu report đang rỗng hoặc backend chưa trả nhóm này.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const summaryQuery = useDashboardSummary();
  const statusQuery = useTicketsByStatusReport();
  const priorityQuery = useTicketsByPriorityReport();
  const categoryQuery = useTicketsByCategoryReport();
  const departmentQuery = useTicketsByDepartmentReport();
  const slaQuery = useDashboardSlaOverview();
  const latestQuery = useTickets({ page: 1, limit: 5 });
  const healthQuery = useHealth();
  const dbHealthQuery = useDbHealth();

  const reportQueries = [
    summaryQuery,
    statusQuery,
    priorityQuery,
    categoryQuery,
    departmentQuery,
    slaQuery,
  ];

  if (reportQueries.some((query) => query.isLoading)) {
    return <DashboardSkeleton />;
  }

  const failedReport = reportQueries.find((query) => query.isError);

  if (failedReport) {
    return <ErrorCard error={failedReport.error} />;
  }

  const summary = summaryQuery.data ?? {
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    closedTickets: 0,
    overdueTickets: 0,
  };
  const sla = slaQuery.data ?? {
    totalTickets: 0,
    overdueTickets: 0,
    resolvedTickets: 0,
    overdueRate: 0,
  };
  const latestTickets = latestQuery.data?.items ?? [];

  const metricCards = [
    {
      label: "Tổng tickets",
      value: formatNumber(summary.totalTickets),
      icon: TicketCheck,
      tone: "teal" as const,
      detail: "Theo phạm vi dữ liệu của tài khoản hiện tại",
    },
    {
      label: "Đang mở",
      value: formatNumber(summary.openTickets),
      icon: Inbox,
      tone: "sky" as const,
      detail: "Cần tiếp nhận hoặc phân loại",
    },
    {
      label: "Đang xử lý",
      value: formatNumber(summary.inProgressTickets),
      icon: Clock,
      tone: "amber" as const,
      detail: "Đang nằm trong luồng hỗ trợ",
    },
    {
      label: "Đã xử lý",
      value: formatNumber(summary.resolvedTickets),
      icon: ShieldCheck,
      tone: "emerald" as const,
      detail: "Đã chuyển sang trạng thái resolved",
    },
    {
      label: "Đã đóng",
      value: formatNumber(summary.closedTickets),
      icon: CheckCircle2,
      tone: "slate" as const,
      detail: "Ticket đã kết thúc hoàn toàn",
    },
    {
      label: "Quá hạn SLA",
      value: formatNumber(summary.overdueTickets),
      icon: AlertTriangle,
      tone: "red" as const,
      detail: "Dựa trên cờ isOverdue từ backend",
    },
    {
      label: "Tỷ lệ quá hạn",
      value: formatPercent(sla.overdueRate),
      icon: TrendingUp,
      tone: sla.overdueRate > 0 ? ("red" as const) : ("emerald" as const),
      detail: `${formatNumber(sla.overdueTickets)} / ${formatNumber(
        sla.totalTickets,
      )} ticket`,
    },
  ];

  const statusRows =
    statusQuery.data?.map((item) => ({
      label: getStatusMeta(item.status)?.label ?? item.status,
      value: item.total,
      color: statusBarColors[item.status],
    })) ?? [];

  const priorityRows =
    priorityQuery.data?.map((item) => ({
      label: getPriorityMeta(item.priority)?.label ?? item.priority,
      value: item.total,
      color: priorityBarColors[item.priority],
    })) ?? [];

  const categoryRows =
    categoryQuery.data
      ?.slice()
      .sort((a, b) => b.total - a.total)
      .map((item) => ({
        label: item.categoryName ?? "Chưa phân loại",
        value: item.total,
        color: "bg-teal-600",
      })) ?? [];

  const departmentRows =
    departmentQuery.data
      ?.slice()
      .sort((a, b) => b.total - a.total)
      .map((item) => ({
        label: item.departmentName,
        value: item.total,
        color: "bg-sky-600",
      })) ?? [];

  return (
    <div className="grid gap-6 motion-enter">
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto] md:items-end md:p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <TrendingUp className="size-3.5" />
              Dashboard report
            </div>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Tổng quan vận hành
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Theo dõi ticket, phân bổ công việc và SLA theo dữ liệu report từ
              backend.
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

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm motion-panel">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>API health</CardDescription>
                <CardTitle>
                  {healthQuery.isLoading
                    ? "Đang kiểm tra"
                    : healthQuery.isError
                      ? "Không kết nối"
                      : healthQuery.data?.ok
                        ? "Đang hoạt động"
                        : "Không rõ trạng thái"}
                </CardTitle>
              </div>
              <div className="grid size-10 place-items-center rounded-xl bg-teal-950/5 text-teal-950">
                <Server className="size-5" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm motion-panel">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>Database health</CardDescription>
                <CardTitle>
                  {dbHealthQuery.isLoading
                    ? "Đang kiểm tra"
                    : dbHealthQuery.isError
                      ? "Không kết nối"
                      : dbHealthQuery.data?.ok
                        ? "Đã kết nối"
                        : "Không rõ trạng thái"}
                </CardTitle>
              </div>
              <div className="grid size-10 place-items-center rounded-xl bg-teal-950/5 text-teal-950">
                <Database className="size-5" />
              </div>
            </div>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card, index) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            detail={card.detail}
            icon={card.icon}
            tone={card.tone}
            index={index}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ReportBarList
          title="Ticket theo trạng thái"
          description="Phân bổ ticket theo status hiện tại."
          icon={BarChart3}
          rows={statusRows}
          emptyText="Chưa có dữ liệu trạng thái"
        />
        <ReportBarList
          title="Ticket theo độ ưu tiên"
          description="Tỷ trọng ticket theo priority."
          icon={PieChart}
          rows={priorityRows}
          emptyText="Chưa có dữ liệu độ ưu tiên"
        />
        <ReportBarList
          title="Ticket theo danh mục"
          description="Nhóm ticket theo category từ backend."
          icon={Layers3}
          rows={categoryRows}
          emptyText="Chưa có dữ liệu danh mục"
        />
        <ReportBarList
          title="Ticket theo phòng ban"
          description="Nhóm theo phòng ban của người tạo ticket."
          icon={Building2}
          rows={departmentRows}
          emptyText="Chưa có dữ liệu phòng ban"
        />
      </section>

      <Card className="shadow-sm motion-panel">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>SLA overview</CardTitle>
              <CardDescription>
                Tổng quan SLA từ endpoint `/dashboard/sla-overview`.
              </CardDescription>
            </div>
            <div className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
              {formatPercent(sla.overdueRate)} quá hạn
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 p-4">
            <CardDescription>Tổng SLA tickets</CardDescription>
            <CardTitle className="mt-2">{formatNumber(sla.totalTickets)}</CardTitle>
          </div>
          <div className="rounded-lg border bg-red-50 p-4 text-red-950">
            <CardDescription className="text-red-800">
              Ticket quá hạn
            </CardDescription>
            <CardTitle className="mt-2">{formatNumber(sla.overdueTickets)}</CardTitle>
          </div>
          <div className="rounded-lg border bg-emerald-50 p-4 text-emerald-950">
            <CardDescription className="text-emerald-800">
              Ticket đã xử lý
            </CardDescription>
            <CardTitle className="mt-2">{formatNumber(sla.resolvedTickets)}</CardTitle>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Ticket mới nhất</CardTitle>
              <CardDescription>
                Dữ liệu thật từ danh sách ticket hiện có.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/tickets">Mở danh sách</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {latestQuery.isLoading ? (
            <div className="grid gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 rounded-xl bg-muted motion-shimmer"
                />
              ))}
            </div>
          ) : latestQuery.isError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">
                Không thể tải ticket mới nhất.
              </p>
            </div>
          ) : latestTickets.length > 0 ? (
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
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <TicketPriorityBadge priority={ticket.priority} />
                      <TicketSlaBadge ticket={ticket} />
                      <span className="text-xs text-muted-foreground">
                        Người tạo: {ticket.createdBy?.name ?? "-"}
                      </span>
                    </div>
                  </div>
                  <div className="px-1">
                    <TicketStatusBadge status={ticket.status} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid min-h-64 place-items-center px-4 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-800">
                  <FilePlus2 className="size-5" />
                </div>
                <p className="font-medium">Chưa có ticket nào</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tạo ticket đầu tiên để bắt đầu theo dõi luồng hỗ trợ.
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/tickets/new">Tạo ticket đầu tiên</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
