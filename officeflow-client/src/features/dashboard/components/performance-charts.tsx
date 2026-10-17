"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardPerformance } from "../types";

const tick = { fill: "var(--muted-foreground)", fontSize: 11 };
const tooltip = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
};
const dateLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

export default function PerformanceCharts({
  report,
}: {
  report: DashboardPerformance;
}) {
  const backlogTotal = report.backlog.reduce((sum, row) => sum + row.total, 0);
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Tiến độ theo ngày tạo</CardTitle>
          <CardDescription>
            Cùng nhóm ticket: số được tạo và số hiện đã xử lý hoặc đóng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-5 bg-chart-1" />
              Được tạo
            </span>
            <span className="flex items-center gap-2">
              <span
                className="h-0.5 w-5 border-t-2 border-dashed"
                style={{ borderColor: "var(--chart-success)" }}
              />
              Hiện đã xử lý / đóng
            </span>
          </div>
          {report.cohort.total === 0 ? (
            <p className="grid h-64 place-items-center text-sm text-muted-foreground">
              Chưa có ticket trong khoảng đã chọn.
            </p>
          ) : (
            <div
              className="h-64"
              role="figure"
              aria-label="Tiến độ ticket theo ngày tạo"
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart
                  data={report.daily}
                  margin={{ top: 10, right: 12, bottom: 0, left: -20 }}
                  accessibilityLayer
                >
                  <CartesianGrid
                    stroke="var(--border)"
                    vertical={false}
                    strokeDasharray="3 4"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={dateLabel}
                    tick={tick}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={tick}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltip}
                    labelFormatter={(label) => String(label)}
                  />
                  <Line
                    dataKey="created"
                    name="Được tạo"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={report.daily.length < 15}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="completed"
                    name="Hiện đã xử lý / đóng"
                    stroke="var(--chart-success)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={report.daily.length < 15}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer py-2 font-medium">
              Xem bảng tiến độ
            </summary>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left tabular-nums">
                <caption className="sr-only">Tiến độ theo ngày tạo</caption>
                <thead>
                  <tr>
                    <th className="py-2">Ngày tạo</th>
                    <th>Được tạo</th>
                    <th>Đã xử lý / đóng</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map((day) => (
                    <tr key={day.date} className="border-t">
                      <th className="py-2 font-normal">{day.date}</th>
                      <td>{day.created}</td>
                      <td>{day.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            Tuổi ticket tồn đọng{" "}
            <span className="text-muted-foreground">· {backlogTotal}</span>
          </CardTitle>
          <CardDescription>
            Toàn bộ ticket đang mở hoặc đang xử lý. Một ngày tuổi = 24 giờ,
            không theo bộ lọc ngày tạo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backlogTotal === 0 ? (
            <p className="grid h-64 place-items-center text-sm text-muted-foreground">
              Không có ticket tồn đọng.
            </p>
          ) : (
            <div
              className="h-64"
              role="figure"
              aria-label="Ticket tồn đọng theo tuổi"
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={report.backlog}
                  layout="vertical"
                  margin={{ top: 10, right: 16, bottom: 0, left: 0 }}
                  accessibilityLayer
                >
                  <CartesianGrid
                    stroke="var(--border)"
                    horizontal={false}
                    strokeDasharray="3 4"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={tick}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={108}
                    tick={tick}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltip}
                    cursor={{ fill: "var(--muted)" }}
                  />
                  <Bar
                    dataKey="total"
                    name="Ticket"
                    fill="var(--chart-3)"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer py-2 font-medium">
              Xem bảng tồn đọng
            </summary>
            <table className="w-full text-left tabular-nums">
              <caption className="sr-only">
                Tuổi ticket tồn đọng hiện tại
              </caption>
              <thead>
                <tr>
                  <th className="py-2">Tuổi thực tế</th>
                  <th>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {report.backlog.map((row) => (
                  <tr key={row.key} className="border-t">
                    <th className="py-2 font-normal">{row.label}</th>
                    <td>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
