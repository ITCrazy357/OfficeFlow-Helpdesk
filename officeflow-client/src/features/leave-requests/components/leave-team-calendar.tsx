"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/utils";
import type { AuthUser } from "@/features/auth/types";
import { useDepartments } from "@/features/departments/hooks";
import { formatLeaveDate, getTodayDateInputValue } from "../constants";
import { useLeaveCalendar } from "../planning";
import {
  leavePeriodLabels,
  leavesOnDate,
  monthDays,
  overlappingLeaveCount,
} from "../planning-utils";

export function LeaveTeamCalendar({ user }: { user: AuthUser }) {
  const [month, setMonth] = useState(getTodayDateInputValue().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(getTodayDateInputValue());
  const [departmentId, setDepartmentId] = useState<number | undefined>(
    user.departmentId ?? undefined,
  );
  const [page, setPage] = useState(1);
  const departments = useDepartments(user.role === "ADMIN");
  const calendar = useLeaveCalendar(month, page, departmentId);
  const days = monthDays(month);
  const offset = days.length
    ? (new Date(`${days[0]}T00:00:00Z`).getUTCDay() + 6) % 7
    : 0;
  const activeDate = selectedDate.startsWith(month) ? selectedDate : days[0];
  const rows = calendar.data?.items ?? [];
  const selected = activeDate ? leavesOnDate(rows, activeDate) : [];
  const incomplete = (calendar.data?.totalPages ?? 0) > 1;
  const maxConcurrent = overlappingLeaveCount(selected);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch nghỉ phòng ban</CardTitle>
        <CardDescription>
          Xem đơn đã duyệt và đang chờ duyệt để sắp xếp người hỗ trợ. Lý do nghỉ
          được giữ riêng tư.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="grid gap-2">
            <Label htmlFor="leave-calendar-month">Tháng</Label>
            <Input
              id="leave-calendar-month"
              type="month"
              min="2000-01"
              max="9998-12"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setPage(1);
              }}
            />
          </div>
          {user.role === "ADMIN" ? (
            <div className="grid min-w-0 flex-1 gap-2">
              <Label htmlFor="leave-calendar-department">Phòng ban</Label>
              <select
                id="leave-calendar-department"
                value={departmentId ?? ""}
                className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm"
                onChange={(event) => {
                  setDepartmentId(Number(event.target.value) || undefined);
                  setPage(1);
                }}
              >
                <option value="">Phòng ban của tôi</option>
                {(departments.data ?? []).map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {departments.isError ? (
                <p className="text-xs text-destructive" role="alert">
                  Không tải được phòng ban.{" "}
                  <button
                    className="underline"
                    onClick={() => departments.refetch()}
                  >
                    Thử lại
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {calendar.isError ? (
          <div role="alert" className="grid gap-2 text-sm text-destructive">
            Không thể tải lịch phòng ban.
            <Button variant="outline" onClick={() => calendar.refetch()}>
              Tải lại lịch
            </Button>
          </div>
        ) : calendar.isPending ? (
          <p className="text-sm text-muted-foreground">Đang tải lịch...</p>
        ) : !calendar.data?.departmentId ? (
          <p className="text-sm text-muted-foreground">
            Chưa có phòng ban để hiển thị lịch.
            {user.role === "ADMIN"
              ? " Chọn một phòng ban ở trên."
              : " Liên hệ ADMIN để cập nhật phòng ban."}
          </p>
        ) : (
          <>
            {incomplete ? (
              <p
                role="status"
                className="rounded-lg border bg-muted/30 p-3 text-sm"
              >
                Đang hiển thị 100 đơn trên trang {calendar.data.page}/
                {calendar.data.totalPages}. Số người và cảnh báo chỉ tính các
                đơn trên trang này; xem các trang còn lại để có đủ lịch.
              </p>
            ) : null}
            <div
              className="grid min-w-0 grid-cols-7 gap-1"
              aria-label={`Lịch nghỉ tháng ${month}`}
            >
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                <div
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                  key={day}
                >
                  {day}
                </div>
              ))}
              {Array.from({ length: offset }, (_, index) => (
                <div key={`empty-${index}`} />
              ))}
              {days.map((date) => {
                const entries = leavesOnDate(rows, date);
                const people = new Set(entries.map((item) => item.requester.id))
                  .size;
                const concurrent = overlappingLeaveCount(entries);
                return (
                  <button
                    key={date}
                    type="button"
                    aria-pressed={date === activeDate}
                    aria-label={`${formatLeaveDate(date)}: ${people} người nghỉ${concurrent > 1 ? `, ${concurrent} người trùng buổi` : ""}`}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "grid min-h-16 min-w-0 content-start gap-1 rounded-md border p-1 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:p-2",
                      date === activeDate && "border-primary bg-primary/10",
                      concurrent > 1 && "border-amber-500/60",
                    )}
                  >
                    <span className="font-medium">{Number(date.slice(8))}</span>
                    {people ? (
                      <span className="text-[10px] leading-4 text-muted-foreground sm:text-xs">
                        {people} người
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div
              className="grid gap-3 rounded-lg border bg-muted/10 p-3"
              aria-live="polite"
            >
              <p className="font-medium">Ngày {formatLeaveDate(activeDate)}</p>
              {maxConcurrent > 1 ? (
                <p
                  role="status"
                  className="text-sm text-amber-800 dark:text-amber-200"
                >
                  Có {maxConcurrent} người nghỉ trùng buổi, gồm cả đơn chờ
                  duyệt. Cần bố trí người thay thế.
                </p>
              ) : null}
              {selected.length ? (
                <ul className="grid gap-2">
                  {selected.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-3 text-sm"
                    >
                      <span className="min-w-0 break-words font-medium">
                        {item.requester.name}
                      </span>
                      <span className="text-muted-foreground">
                        {leavePeriodLabels[item.period ?? "FULL_DAY"]} ·{" "}
                        {item.status === "APPROVED" ? "Đã duyệt" : "Chờ duyệt"}
                        {!item.days?.length ? " · Lịch cũ" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Không có đơn nghỉ trong ngày này.
                </p>
              )}
            </div>
            {incomplete ? (
              <div className="flex flex-wrap justify-between gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1 || calendar.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    page >= calendar.data.totalPages || calendar.isFetching
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Trang sau
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
