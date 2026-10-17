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
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { OfficeFlowFigure } from "@/components/ui/officeflow-figure";
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
import { getTicketCategoryLabel } from "@/features/ticket-categories/constants";
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
import { useMe } from "@/features/auth/hooks";
import type { TicketPriority, TicketStatus } from "@/features/tickets/types";
import { getApiErrorMessage } from "@/lib/axios";

const PerformanceReport = dynamic(
  () => import("@/features/dashboard/components/performance-report"),
  {
    ssr: false,
    loading: () => <p role="status">Đang tải báo cáo hiệu quả xử lý…</p>,
  },
);

const AdminDashboardCharts = dynamic(
  () => import("@/features/dashboard/components/admin-dashboard-charts"),
  {
    ssr: false,
    loading: () => (
      <div
        className="grid gap-4 xl:grid-cols-2"
        role="status"
        aria-label="Đang tải biểu đồ quản trị"
      >
        <div className="h-96 rounded-xl bg-muted motion-shimmer" />
        <div className="h-96 rounded-xl bg-muted motion-shimmer" />
      </div>
    ),
  },
);

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
          <CardTitle>Không thể tải tổng quan</CardTitle>
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
    teal: "bg-teal-950/5 dark:bg-teal-200/10 text-teal-950 dark:text-teal-200",
    sky: "bg-sky-950/5 dark:bg-sky-200/10 text-sky-900 dark:text-sky-200",
    emerald:
      "bg-emerald-950/5 dark:bg-emerald-200/10 text-emerald-900 dark:text-emerald-200",
    amber:
      "bg-amber-100 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200",
    red: "bg-red-100 dark:bg-red-400/10 text-red-700 dark:text-red-200",
    slate:
      "bg-slate-100 dark:bg-slate-400/10 text-slate-700 dark:text-slate-200",
  };

  return (
    <Card
      className="motion-card"
      style={{ "--motion-index": index } as CSSProperties}
    >
      <CardContent className="pt-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
              {value}
            </CardTitle>
          </div>
          <div
            className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}
          >
            <Icon className="size-5" />
          </div>
        </div>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">{detail}</p>
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
                      style={{ width: `${percent}%` }}
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
                Các yêu cầu phù hợp sẽ được tổng hợp tại đây.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: user } = useMe();
  const isAdmin = user?.role === "ADMIN";
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
      detail: "Trong phạm vi công việc của bạn",
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
      detail: "Đã có kết quả hỗ trợ",
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
      detail: "Đã vượt thời hạn hỗ trợ",
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
        label: getTicketCategoryLabel(item.categoryName),
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
      <section className="overflow-hidden rounded-xl bg-accent/60">
        <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center md:p-7">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Tổng quan vận hành
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Nắm việc cần xử lý, theo dõi tiến độ và giữ các yêu cầu đúng hạn.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/tickets">
                  Xem tickets
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild>
                <Link href="/tickets/new">
                  <Plus className="size-4" />
                  Tạo ticket
                </Link>
              </Button>
            </div>
          </div>
          <OfficeFlowFigure
            kind="hub"
            className="hidden sm:block [--hairline-plate:var(--accent)]"
          />
        </div>
      </section>

      <PerformanceReport />

      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Tổng quan toàn bộ ticket
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Các số liệu bên dưới bao gồm mọi ngày tạo trong phạm vi quyền của bạn.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.slice(0, 4).map((card, index) => (
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

      <section
        aria-label="Kết quả và thời hạn"
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3 sm:gap-6 sm:p-5"
      >
        {metricCards.slice(4).map((card) => (
          <div
            key={card.label}
            className="flex items-center justify-between gap-3 sm:block"
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-xl font-semibold tabular-nums sm:mt-1">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      {isAdmin ? (
        <AdminDashboardCharts
          summary={summary}
          sla={sla}
          statuses={statusQuery.data ?? []}
          priorities={priorityQuery.data ?? []}
          categories={categoryQuery.data ?? []}
          departments={departmentQuery.data ?? []}
        />
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-2">
            <ReportBarList
              title="Ticket theo trạng thái"
              description="Những yêu cầu đang ở đâu trong luồng hỗ trợ."
              icon={BarChart3}
              rows={statusRows}
              emptyText="Chưa có dữ liệu trạng thái"
            />
            <ReportBarList
              title="Ticket theo độ ưu tiên"
              description="Phân bổ theo mức độ cần ưu tiên xử lý."
              icon={PieChart}
              rows={priorityRows}
              emptyText="Chưa có dữ liệu độ ưu tiên"
            />
            <ReportBarList
              title="Ticket theo danh mục"
              description="Các nhóm vấn đề cần hỗ trợ."
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
                  <CardTitle>Thời hạn hỗ trợ</CardTitle>
                  <CardDescription>
                    Theo dõi cam kết xử lý và các yêu cầu cần chú ý.
                  </CardDescription>
                </div>
                <div className="rounded-full border border-red-200 dark:border-red-400/25 bg-red-50 dark:bg-red-400/10 px-3 py-1 text-sm font-semibold text-red-700 dark:text-red-200">
                  {formatPercent(sla.overdueRate)} quá hạn
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-0 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <CardDescription>Tổng SLA tickets</CardDescription>
                <CardTitle className="mt-2">
                  {formatNumber(sla.totalTickets)}
                </CardTitle>
              </div>
              <div className="rounded-lg border bg-red-50 dark:bg-red-400/10 p-4 text-red-950 dark:text-red-200">
                <CardDescription className="text-red-800 dark:text-red-200">
                  Ticket quá hạn
                </CardDescription>
                <CardTitle className="mt-2">
                  {formatNumber(sla.overdueTickets)}
                </CardTitle>
              </div>
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-400/10 p-4 text-emerald-950 dark:text-emerald-200">
                <CardDescription className="text-emerald-800 dark:text-emerald-200">
                  Ticket đã xử lý
                </CardDescription>
                <CardTitle className="mt-2">
                  {formatNumber(sla.resolvedTickets)}
                </CardTitle>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Ticket mới nhất</CardTitle>
              <CardDescription>
                Các yêu cầu vừa được gửi đến đội ngũ hỗ trợ.
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
                <OfficeFlowFigure kind="drawer" className="mx-auto w-36" />
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
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm motion-panel">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>Dịch vụ hỗ trợ</CardDescription>
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
              <div className="grid size-10 place-items-center rounded-xl bg-teal-950/5 dark:bg-teal-200/10 text-teal-950 dark:text-teal-200">
                <Server className="size-5" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm motion-panel">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription>Kết nối dữ liệu</CardDescription>
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
              <div className="grid size-10 place-items-center rounded-xl bg-teal-950/5 dark:bg-teal-200/10 text-teal-950 dark:text-teal-200">
                <Database className="size-5" />
              </div>
            </div>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
