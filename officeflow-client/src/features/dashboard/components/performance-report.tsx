"use client";

import { useId, useState, type FormEvent } from "react";
import { Download, FileText, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/axios";
import { useDashboardPerformance } from "../hooks";
import { printPerformanceReport } from "../performance-print";
import {
  formatSlaDuration,
  performanceCsv,
  performanceDates,
  validatePerformanceDates,
} from "../performance-utils";

const PerformanceCharts = dynamic(() => import("./performance-charts"), {
  ssr: false,
  loading: () => (
    <p role="status" className="py-12 text-sm text-muted-foreground">
      Đang tải biểu đồ hiệu quả xử lý…
    </p>
  ),
});

const number = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);

export default function PerformanceReport() {
  const id = useId();
  const [dates, setDates] = useState(() => performanceDates());
  const [draft, setDraft] = useState(dates);
  const [validation, setValidation] = useState<string | null>(null);
  const query = useDashboardPerformance(dates);
  const report = query.data?.report;
  const error = query.error ?? query.data?.accessError;
  const today = performanceDates(1).to;

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validatePerformanceDates(draft, today);
    setValidation(error);
    if (error) return;
    if (draft.from === dates.from && draft.to === dates.to)
      void query.refetch();
    else setDates({ ...draft });
  }

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([performanceCsv(report)], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `officeflow-hieu-qua-${report.range.from}-${report.range.to}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-labelledby={`${id}-title`} className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id={`${id}-title`}
            className="text-xl font-semibold tracking-tight"
          >
            Hiệu quả xử lý
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Chọn nhóm ticket theo ngày tạo, xem kết quả hiện tại trong phạm vi
            quyền của bạn. Các khoảng ngày tính theo giờ Việt Nam.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={download}
            disabled={!report || query.isFetching}
          >
            <Download className="size-4" />
            Xuất CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => report && printPerformanceReport(report)}
            disabled={!report || query.isFetching}
            title="Mở bản in A4, chọn Lưu dưới dạng PDF"
          >
            <FileText className="size-4" />
            Xuất PDF
          </Button>
        </div>
      </div>
      <form
        onSubmit={apply}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-xl border bg-card p-4 sm:flex sm:flex-wrap"
      >
        <label
          className="col-span-2 grid min-w-0 gap-1.5 text-sm sm:flex-none"
          htmlFor={`${id}-from`}
        >
          Tạo từ ngày
          <Input
            id={`${id}-from`}
            type="date"
            value={draft.from}
            max={today}
            required
            aria-invalid={!!validation}
            aria-describedby={validation ? `${id}-error` : undefined}
            onChange={(event) =>
              setDraft({ ...draft, from: event.target.value })
            }
          />
        </label>
        <label
          className="col-span-2 grid min-w-0 gap-1.5 text-sm sm:flex-none"
          htmlFor={`${id}-to`}
        >
          Đến ngày
          <Input
            id={`${id}-to`}
            type="date"
            value={draft.to}
            max={today}
            required
            aria-invalid={!!validation}
            aria-describedby={validation ? `${id}-error` : undefined}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          />
        </label>
        <Button type="submit" disabled={query.isFetching}>
          Áp dụng
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label="Làm mới báo cáo"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw className="size-4" />
        </Button>
        <div
          className="col-span-2 flex flex-wrap gap-1"
          aria-label="Khoảng ngày nhanh"
        >
          {[7, 30, 90].map((days) => (
            <Button
              key={days}
              type="button"
              size="sm"
              variant="ghost"
              disabled={query.isFetching}
              onClick={() => {
                const next = performanceDates(days);
                setDraft(next);
                setDates(next);
                setValidation(null);
              }}
            >
              {days} ngày
            </Button>
          ))}
        </div>
        {validation && (
          <p
            id={`${id}-error`}
            role="alert"
            className="w-full text-sm text-destructive"
          >
            {validation}
          </p>
        )}
      </form>
      {query.isFetching && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tải báo cáo…
        </p>
      )}
      {Boolean(error) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/25 p-4 text-sm"
        >
          <p>
            {getApiErrorMessage(error, "Không thể tải báo cáo hiệu quả xử lý.")}
          </p>
          {report && (
            <p className="mt-1 text-muted-foreground">
              Đang giữ bản tải thành công trước đó; xem thời điểm quan sát bên
              dưới.
            </p>
          )}
          <Button
            className="mt-2"
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            Thử lại báo cáo
          </Button>
        </div>
      )}
      {report && (
        <>
          <p className="text-xs leading-5 text-muted-foreground">
            Nhóm tạo {report.range.from} → {report.range.to} · Quan sát lúc{" "}
            {new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: report.range.timezone,
            }).format(new Date(report.generatedAt))}
            . Báo cáo có bộ nhớ đệm.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Đã xử lý / đóng",
                value: `${number(report.cohort.completed)} / ${number(report.cohort.total)}`,
                detail: "Trạng thái hiện tại trong nhóm được chọn.",
              },
              {
                label: "Phản hồi đầu tiên TB",
                value: formatSlaDuration(report.cohort.firstResponse.minutes),
                detail: `${number(report.cohort.firstResponse.samples)} / ${number(report.cohort.total)} ticket có mốc phản hồi hợp lệ.`,
              },
              {
                label: "Giải quyết TB",
                value: formatSlaDuration(report.cohort.resolution.minutes),
                detail: `${number(report.cohort.resolution.samples)} / ${number(report.cohort.completed)} ticket đã xử lý/đóng có mốc hợp lệ, tính đến lần giải quyết cuối.`,
              },
              {
                label: "Tỷ lệ từng mở lại",
                value:
                  report.cohort.reopenRate === null
                    ? "—"
                    : `${number(report.cohort.reopenRate)}%`,
                detail: `${number(report.cohort.reopened)} / ${number(report.cohort.everCompleted)} ticket từng được xử lý; mỗi ticket đếm một lần.`,
              },
            ].map((metric) => (
              <Card key={metric.label}>
                <CardContent>
                  <CardDescription>{metric.label}</CardDescription>
                  <CardTitle className="mt-2 text-2xl tabular-nums">
                    {metric.value}
                  </CardTitle>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {metric.detail}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Thời gian tính từ lúc tạo theo lịch SLA lưu trên từng ticket, gồm
            các khoảng làm việc và loại trừ ngày nghỉ đã cấu hình. Không có mốc
            thì hiển thị “—”, không tính là 0.{" "}
            {report.cohort.legacyCalendarTickets > 0 &&
              `${number(report.cohort.legacyCalendarTickets)} ticket cũ chưa lưu lịch SLA được tính theo 24/7.`}
          </p>
          <PerformanceCharts report={report} />
        </>
      )}
    </section>
  );
}
