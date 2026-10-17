"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CalendarPlus2, LockKeyhole } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getLeaveRequestErrorMessage,
  getTodayDateInputValue,
} from "../constants";
import { useLeavePreview } from "../planning";
import { leavePeriodLabels, leaveTypeLabels } from "../planning-utils";
import {
  leaveRequestFormSchema,
  type LeaveRequestFormValues,
} from "../schemas";

type LeaveRequestFormProps = {
  isSubmitting?: boolean;
  error?: string | null;
  onSubmit: (values: LeaveRequestFormValues) => Promise<void> | void;
};

export function LeaveRequestForm({
  isSubmitting = false,
  error,
  onSubmit,
}: LeaveRequestFormProps) {
  const today = getTodayDateInputValue();
  const form = useForm<LeaveRequestFormValues>({
    resolver: zodResolver(leaveRequestFormSchema),
    defaultValues: {
      type: "ANNUAL",
      period: "FULL_DAY",
      startDate: "",
      endDate: "",
      reason: "",
    },
  });
  const [startDate, endDate, type, period] = useWatch({
    control: form.control,
    name: ["startDate", "endDate", "type", "period"],
  });
  const preview = useLeavePreview(
    { startDate, endDate, type, period },
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(endDate) &&
      endDate >= startDate &&
      (period === "FULL_DAY" || startDate === endDate),
  );

  const handleSubmit: SubmitHandler<LeaveRequestFormValues> = async (
    values,
  ) => {
    await onSubmit(values);
  };

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <Label htmlFor="leave-type">Loại nghỉ</Label>
          <select
            id="leave-type"
            className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm"
            disabled={isSubmitting}
            {...form.register("type")}
          >
            {(["ANNUAL", "UNPAID", "SICK"] as const).map((value) => (
              <option key={value} value={value}>
                {leaveTypeLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor="leave-period">Thời gian nghỉ</Label>
          <select
            id="leave-period"
            className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm"
            disabled={isSubmitting}
            {...form.register("period")}
          >
            {(["FULL_DAY", "MORNING", "AFTERNOON"] as const).map((value) => (
              <option key={value} value={value}>
                {leavePeriodLabels[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid min-w-0 content-start gap-2">
          <Label htmlFor="leave-start-date">Ngày bắt đầu</Label>
          <Input
            id="leave-start-date"
            type="date"
            min={today}
            aria-invalid={Boolean(form.formState.errors.startDate)}
            aria-describedby="leave-start-date-help"
            disabled={isSubmitting}
            {...form.register("startDate")}
          />
          <p
            id="leave-start-date-help"
            className="text-xs text-muted-foreground"
          >
            Chọn ngày đầu tiên bạn dự kiến nghỉ.
          </p>
          {form.formState.errors.startDate?.message ? (
            <p className="text-xs font-medium text-destructive">
              {form.formState.errors.startDate.message}
            </p>
          ) : null}
        </div>

        <div className="grid min-w-0 content-start gap-2">
          <Label htmlFor="leave-end-date">Ngày kết thúc</Label>
          <Input
            id="leave-end-date"
            type="date"
            min={startDate || today}
            aria-invalid={Boolean(form.formState.errors.endDate)}
            aria-describedby="leave-end-date-help"
            disabled={isSubmitting}
            {...form.register("endDate")}
          />
          <p id="leave-end-date-help" className="text-xs text-muted-foreground">
            Chỉ tính ngày làm việc, loại ngày nghỉ theo lịch SLA.
          </p>
          {form.formState.errors.endDate?.message ? (
            <p className="text-xs font-medium text-destructive">
              {form.formState.errors.endDate.message}
            </p>
          ) : null}
        </div>
      </div>

      {preview.isFetching ? (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tính ngày công...
        </p>
      ) : preview.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {getLeaveRequestErrorMessage(preview.error)}
        </p>
      ) : preview.data ? (
        <div
          className="grid gap-1 rounded-lg border bg-muted/20 p-3 text-sm"
          role="status"
        >
          <p className="font-medium">
            Thời lượng: {preview.data.days} ngày công
          </p>
          {type === "ANNUAL" ? (
            preview.data.balances.map((balance) => (
              <p key={balance.year} className="text-muted-foreground">
                Năm {balance.year}:{" "}
                {balance.remaining === null
                  ? "Chưa cấu hình hạn mức — liên hệ ADMIN trước khi gửi."
                  : `Còn ${balance.remaining} ngày khả dụng (đã trừ phần chờ duyệt).`}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">
              Loại nghỉ này không trừ phép năm.
            </p>
          )}
        </div>
      ) : null}

      <div className="grid min-w-0 content-start gap-2">
        <Label htmlFor="leave-reason">Lý do nghỉ</Label>
        <Textarea
          id="leave-reason"
          className="min-h-36 resize-y"
          placeholder="Mô tả ngắn gọn lý do và thông tin cần thiết cho người duyệt"
          maxLength={2000}
          aria-invalid={Boolean(form.formState.errors.reason)}
          aria-describedby="leave-reason-help"
          disabled={isSubmitting}
          {...form.register("reason")}
        />
        <div
          id="leave-reason-help"
          className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
        >
          <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Nội dung chỉ dành cho bạn và người quản lý được chỉ định duyệt đơn.
          </span>
        </div>
        {form.formState.errors.reason?.message ? (
          <p className="text-xs font-medium text-destructive">
            {form.formState.errors.reason.message}
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          <CalendarPlus2 className="size-4" />
          {isSubmitting ? "Đang gửi đơn..." : "Gửi đơn nghỉ"}
        </Button>
      </div>
    </form>
  );
}
