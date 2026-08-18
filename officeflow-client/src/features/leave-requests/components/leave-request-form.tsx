"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CalendarPlus2, LockKeyhole } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLeaveDayCount, getTodayDateInputValue } from "../constants";
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
      startDate: "",
      endDate: "",
      reason: "",
    },
  });
  const [startDate, endDate] = useWatch({
    control: form.control,
    name: ["startDate", "endDate"],
  });
  const dayCount = getLeaveDayCount(startDate, endDate);

  const handleSubmit: SubmitHandler<LeaveRequestFormValues> = async (values) => {
    await onSubmit(values);
  };

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
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

        <div className="grid gap-2">
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
            {dayCount > 0
              ? `${dayCount} ngày theo lịch, tính cả ngày đầu và ngày cuối.`
              : "Chọn ngày cuối cùng của kỳ nghỉ."}
          </p>
          {form.formState.errors.endDate?.message ? (
            <p className="text-xs font-medium text-destructive">
              {form.formState.errors.endDate.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
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
