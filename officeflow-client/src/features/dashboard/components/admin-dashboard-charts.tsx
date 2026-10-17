"use client";

import { useId, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, ChartNoAxesCombined, UsersRound } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTicketCategoryLabel } from "@/features/ticket-categories/constants";
import { getPriorityMeta, getStatusMeta } from "@/features/tickets/constants";
import { useTicketWorkload } from "@/features/tickets/hooks";
import { getApiErrorMessage } from "@/lib/axios";
import type {
  DashboardCategoryReportItem,
  DashboardDepartmentReportItem,
  DashboardPriorityReportItem,
  DashboardSlaOverview,
  DashboardStatusReportItem,
  DashboardSummary,
} from "../types";

type Datum = { label: string; value: number; fill: string };
type Props = {
  summary: DashboardSummary;
  sla: DashboardSlaOverview;
  statuses: DashboardStatusReportItem[];
  priorities: DashboardPriorityReportItem[];
  categories: DashboardCategoryReportItem[];
  departments: DashboardDepartmentReportItem[];
};

const number = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const percent = (part: number, total: number) =>
  total > 0
    ? new Intl.NumberFormat("vi-VN", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(part / total)
    : "—";
const shorten = (label: string, max = 17) =>
  label.length > max ? `${label.slice(0, max - 1)}…` : label;
const statusColors = {
  OPEN: "var(--chart-1)",
  IN_PROGRESS: "var(--chart-2)",
  RESOLVED: "var(--chart-success)",
  CLOSED: "var(--chart-neutral)",
  CANCELLED: "var(--chart-danger)",
};
const priorityColors = {
  LOW: "var(--chart-neutral)",
  MEDIUM: "var(--chart-2)",
  HIGH: "var(--chart-3)",
  URGENT: "var(--chart-danger)",
};
const tooltipStyle = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
  fontSize: 13,
};

function CategoryTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
}) {
  const label = String(payload?.value ?? "");
  return (
    <text
      x={x}
      y={y}
      dy="0.35em"
      textAnchor="end"
      fill="var(--foreground)"
      fontSize={11}
    >
      <title>{label}</title>
      {shorten(label, 16)}
    </text>
  );
}

function EmptyChart() {
  return (
    <div className="grid min-h-60 content-center justify-items-center gap-2 text-center">
      <ChartNoAxesCombined
        className="size-7 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="font-medium">Chưa có số liệu</p>
      <p className="max-w-64 text-sm text-muted-foreground">
        Biểu đồ sẽ xuất hiện khi có yêu cầu trong nhóm này.
      </p>
    </div>
  );
}

function ChartPanel({
  title,
  description,
  children,
  action,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle id={id}>{title}</CardTitle>
            <CardDescription className="mt-1 leading-5">
              {description}
            </CardDescription>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        <figure aria-labelledby={id} className="min-w-0">
          {children}
        </figure>
      </CardContent>
    </Card>
  );
}

function DataTable({ rows, caption }: { rows: Datum[]; caption: string }) {
  return (
    <details className="mt-4 border-t pt-3 text-xs">
      <summary className="w-fit cursor-pointer rounded-sm py-1 font-medium text-muted-foreground hover:text-foreground">
        Xem bảng số liệu
      </summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-2 font-medium">
                Nhóm
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Ticket
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.label}-${index}`}
                className="border-b last:border-0"
              >
                <th
                  scope="row"
                  className="max-w-64 py-2 pr-3 font-normal break-words"
                >
                  {row.label}
                </th>
                <td className="py-2 text-right">{number(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Donut({ rows }: { rows: Datum[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!total) return <EmptyChart />;
  return (
    <>
      <div className="relative mx-auto h-60 w-full max-w-72">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart accessibilityLayer>
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={{ color: "var(--foreground)" }}
              formatter={(value) => [
                `${number(Number(value))} ticket`,
                "Số lượng",
              ]}
            />
            <Pie
              data={rows.filter((row) => row.value > 0)}
              dataKey="value"
              nameKey="label"
              innerRadius="67%"
              outerRadius="90%"
              paddingAngle={3}
              cornerRadius={4}
              stroke="var(--card)"
              strokeWidth={3}
              isAnimationActive={false}
            ></Pie>
          </PieChart>
        </ResponsiveContainer>
        <div
          className="pointer-events-none absolute inset-0 grid content-center justify-items-center gap-1"
          aria-hidden="true"
        >
          <span className="text-3xl font-semibold tabular-nums">
            {number(total)}
          </span>
          <span className="text-xs text-muted-foreground">tổng ticket</span>
        </div>
      </div>
      <ul className="mt-3 grid gap-2.5 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: row.fill }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">{row.label}</span>
            <span className="tabular-nums">{number(row.value)}</span>
            <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
              {percent(row.value, total)}
            </span>
          </li>
        ))}
      </ul>
      <DataTable rows={rows} caption="Ticket theo trạng thái" />
    </>
  );
}

function RankedChart({ rows }: { rows: Datum[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, 6);
  const hasData = rows.some((row) => row.value > 0);
  return (
    <>
      {!hasData ? (
        <EmptyChart />
      ) : (
        <div
          className="max-h-[460px] overflow-y-auto"
          tabIndex={rows.length > 8 && expanded ? 0 : undefined}
          aria-label="Biểu đồ xếp hạng ticket"
          role="group"
        >
          <div style={{ height: Math.max(240, visible.length * 43) }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={visible}
                layout="vertical"
                margin={{ top: 8, right: 36, bottom: 0, left: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="var(--border)"
                  strokeDasharray="3 4"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tickLine={false}
                  axisLine={false}
                  tick={<CategoryTick />}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "var(--foreground)" }}
                  formatter={(value) => [
                    `${number(Number(value))} ticket`,
                    "Số lượng",
                  ]}
                />
                <Bar
                  dataKey="value"
                  name="Ticket"
                  radius={[0, 5, 5, 0]}
                  barSize={18}
                  isAnimationActive={false}
                >
                  {visible.map((row, index) => (
                    <Cell key={`${row.label}-${index}`} fill={row.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {rows.length > 6 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          className="mt-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Thu gọn" : `Xem tất cả ${number(rows.length)} nhóm`}
        </Button>
      ) : null}
      <DataTable rows={rows} caption="Số ticket theo từng nhóm" />
    </>
  );
}

function WorkloadChart() {
  const query = useTicketWorkload();
  const users = [...(query.data?.items ?? [])].sort(
    (a, b) => b.totalTickets - a.totalTickets,
  );
  return (
    <ChartPanel
      title="Tải công việc đội hỗ trợ"
      description="Ticket đang mở và đang xử lý theo người được giao."
      action={
        <UsersRound
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      }
    >
      {query.isLoading ? (
        <div className="h-60 rounded-lg bg-muted motion-shimmer" role="status">
          <span className="sr-only">Đang tải công việc đội hỗ trợ</span>
        </div>
      ) : query.isError ? (
        <div className="grid min-h-60 content-center gap-3 text-sm">
          <p role="alert" className="text-destructive">
            {getApiErrorMessage(
              query.error,
              "Không thể tải công việc đội hỗ trợ.",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {number(query.data?.unassignedTickets ?? 0)}
            </strong>{" "}
            ticket chưa được phân công
          </p>
          {users.some((user) => user.totalTickets > 0) ? (
            <div
              className="max-h-80 overflow-y-auto"
              tabIndex={users.length > 6 ? 0 : undefined}
              aria-label="Phân công theo nhân sự"
              role="group"
            >
              <div style={{ height: Math.max(220, users.length * 42) }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    data={users}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                    accessibilityLayer
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke="var(--border)"
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={108}
                      tickLine={false}
                      axisLine={false}
                      tick={<CategoryTick />}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: "var(--foreground)" }}
                      formatter={(value, name) => [number(Number(value)), name]}
                    />
                    <Bar
                      dataKey="openTickets"
                      name="Đang mở"
                      stackId="work"
                      fill="var(--chart-1)"
                      barSize={18}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="inProgressTickets"
                      name="Đang xử lý"
                      stackId="work"
                      fill="var(--chart-2)"
                      radius={[0, 5, 5, 0]}
                      barSize={18}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <EmptyChart />
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-sm bg-chart-1" />
              Đang mở
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-sm bg-chart-2" />
              Đang xử lý
            </span>
          </div>
          <DataTable
            rows={users.map((user) => ({
              label: user.name,
              value: user.totalTickets,
              fill: "var(--chart-1)",
            }))}
            caption="Tổng ticket đang mở hoặc đang xử lý theo nhân sự"
          />
        </>
      )}
    </ChartPanel>
  );
}

export default function AdminDashboardCharts({
  summary,
  sla,
  statuses,
  priorities,
  categories,
  departments,
}: Props) {
  const active = summary.openTickets + summary.inProgressTickets;
  const completed = summary.resolvedTickets + summary.closedTickets;
  const statusRows = Object.keys(statusColors).map((key) => {
    const status = key as keyof typeof statusColors;
    return {
      label: getStatusMeta(status)?.label ?? status,
      value: statuses.find((row) => row.status === status)?.total ?? 0,
      fill: statusColors[status],
    };
  });
  const priorityRows = (["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map(
    (priority) => ({
      label: getPriorityMeta(priority)?.label ?? priority,
      value: priorities.find((row) => row.priority === priority)?.total ?? 0,
      fill: priorityColors[priority],
    }),
  );
  const categoryRows = categories
    .map((row) => ({
      label: getTicketCategoryLabel(row.categoryName),
      value: row.total,
      fill: "var(--chart-1)",
    }))
    .sort((a, b) => b.value - a.value);
  const departmentRows = departments
    .map((row) => ({
      label: row.departmentName,
      value: row.total,
      fill: "var(--chart-2)",
    }))
    .sort((a, b) => b.value - a.value);
  const remaining = Math.max(0, sla.totalTickets - sla.overdueTickets);
  return (
    <section
      aria-label="Phân tích quản trị"
      className="admin-analytics grid gap-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 pb-1">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Bức tranh hỗ trợ
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Toàn bộ ticket trong hệ thống · Số liệu tích lũy
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/tickets">
            Mở danh sách ticket
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="grid gap-3 rounded-xl border bg-card px-5 py-4 sm:grid-cols-3 sm:gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Cần tiếp tục xử lý</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {number(active)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ticket đang mở hoặc xử lý
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Đã xử lý hoặc đóng</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {percent(completed, summary.totalTickets)}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {number(completed)} / {number(summary.totalTickets)} ticket
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Nhóm vấn đề nổi bật</p>
          <p
            className="mt-2 truncate text-sm font-semibold"
            title={categoryRows[0]?.label}
          >
            {categoryRows[0]?.value ? categoryRows[0].label : "Chưa có dữ liệu"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {categoryRows[0]?.value
              ? `${number(categoryRows[0].value)} ticket thuộc nhóm này`
              : "Chờ yêu cầu hỗ trợ đầu tiên"}
          </p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ChartPanel
          title="Trạng thái yêu cầu"
          description="Phân bố ticket trong từng bước xử lý."
        >
          <Donut rows={statusRows} />
        </ChartPanel>
        <ChartPanel
          title="Mức độ ưu tiên"
          description="Nhận diện các yêu cầu cần ưu tiên nguồn lực."
        >
          {priorityRows.some((row) => row.value > 0) ? (
            <div className="h-72 pt-5">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={priorityRows}
                  margin={{ top: 12, right: 8, bottom: 12, left: -20 }}
                  accessibilityLayer
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="3 4"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--foreground)", fontSize: 12 }}
                    tickMargin={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "var(--foreground)" }}
                    cursor={{ fill: "var(--muted)" }}
                    formatter={(value) => [
                      `${number(Number(value))} ticket`,
                      "Số lượng",
                    ]}
                  />
                  <Bar
                    dataKey="value"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={64}
                    isAnimationActive={false}
                  >
                    {priorityRows.map((row) => (
                      <Cell key={row.label} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart />
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {priorityRows.map((row) => (
              <div key={row.label}>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="size-2 rounded-sm"
                    style={{ background: row.fill }}
                  />
                  {row.label}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {number(row.value)}
                </p>
              </div>
            ))}
          </div>
          <DataTable rows={priorityRows} caption="Ticket theo độ ưu tiên" />
        </ChartPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Nhóm vấn đề thường gặp"
          description="Sắp xếp danh mục theo số lượng yêu cầu."
        >
          <RankedChart rows={categoryRows} />
        </ChartPanel>
        <ChartPanel
          title="Nhu cầu theo phòng ban"
          description="Số yêu cầu theo phòng ban của người gửi."
        >
          <RankedChart rows={departmentRows} />
        </ChartPanel>
        <ChartPanel
          title="Theo dõi thời hạn SLA"
          description="Ticket đã ghi nhận quá hạn và phần còn lại."
        >
          {sla.totalTickets > 0 ? (
            <>
              <p className="text-4xl font-semibold tabular-nums tracking-tight">
                {percent(sla.overdueTickets, sla.totalTickets)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  đã quá hạn
                </span>
              </p>
              <div className="mt-6 h-20">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    layout="vertical"
                    data={[
                      { label: "SLA", overdue: sla.overdueTickets, remaining },
                    ]}
                    accessibilityLayer
                  >
                    <XAxis type="number" hide domain={[0, sla.totalTickets]} />
                    <YAxis type="category" dataKey="label" hide />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: "var(--foreground)" }}
                      formatter={(value, name) => [
                        `${number(Number(value))} ticket`,
                        name,
                      ]}
                    />
                    <Bar
                      dataKey="overdue"
                      name="Đã ghi nhận quá hạn"
                      fill="var(--chart-danger)"
                      stackId="sla"
                      barSize={32}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="remaining"
                      name="Chưa ghi nhận quá hạn"
                      fill="var(--chart-1)"
                      stackId="sla"
                      barSize={32}
                      isAnimationActive={false}
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-2">
                    <span className="size-2 rounded-sm bg-[var(--chart-danger)]" />
                    Đã ghi nhận quá hạn
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {number(sla.overdueTickets)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-2">
                    <span className="size-2 rounded-sm bg-chart-1" />
                    Chưa ghi nhận quá hạn
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {number(remaining)}
                  </dd>
                </div>
              </dl>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                Ticket chưa ghi nhận quá hạn có thể vẫn đang xử lý. Các số liệu
                này không phải tỷ lệ hoàn tất đúng hạn.
              </p>
              <DataTable
                rows={[
                  {
                    label: "Đã ghi nhận quá hạn",
                    value: sla.overdueTickets,
                    fill: "var(--chart-danger)",
                  },
                  {
                    label: "Chưa ghi nhận quá hạn",
                    value: remaining,
                    fill: "var(--chart-1)",
                  },
                ]}
                caption="Phân bố ticket theo ghi nhận quá hạn SLA"
              />
            </>
          ) : (
            <EmptyChart />
          )}
        </ChartPanel>
        <WorkloadChart />
      </div>
    </section>
  );
}
