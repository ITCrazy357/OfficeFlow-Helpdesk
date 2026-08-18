"use client";

import {
  ArrowLeft,
  CalendarClock,
  CircleCheck,
  LockKeyhole,
  MailCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LeaveRequestForm } from "@/features/leave-requests/components/leave-request-form";
import { getLeaveRequestErrorMessage } from "@/features/leave-requests/constants";
import { useCreateLeaveRequest } from "@/features/leave-requests/hooks";
import {
  toLeaveRequestPayload,
  type LeaveRequestFormValues,
} from "@/features/leave-requests/schemas";

export default function NewLeaveRequestPage() {
  const router = useRouter();
  const createLeaveRequest = useCreateLeaveRequest();
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(values: LeaveRequestFormValues) {
    setFormError(null);

    try {
      const leaveRequest = await createLeaveRequest.mutateAsync(
        toLeaveRequestPayload(values),
      );
      router.push(`/leave-requests/${leaveRequest.id}?created=success`);
    } catch (error) {
      setFormError(
        getLeaveRequestErrorMessage(
          error,
          "Không thể tạo đơn nghỉ phép. Vui lòng thử lại.",
        ),
      );
    }
  }

  const guidance = [
    {
      icon: CalendarClock,
      text: "Ngày nghỉ không được trùng với đơn đang chờ duyệt hoặc đã được duyệt.",
    },
    {
      icon: CircleCheck,
      text: "Đơn được gửi tới quản lý trực tiếp đã gán cho tài khoản của bạn.",
    },
    {
      icon: LockKeyhole,
      text: "Lý do nghỉ không hiển thị cho Admin nếu họ không phải người duyệt được chỉ định.",
    },
    {
      icon: MailCheck,
      text: "Email thông báo có thể được gửi nếu tính năng email của hệ thống đang bật.",
    },
  ];

  return (
    <div className="grid gap-6 motion-enter">
      <section>
        <Button asChild variant="ghost" className="-ml-2 mb-2">
          <Link href="/leave-requests">
            <ArrowLeft className="size-4" />
            Quay lại
          </Link>
        </Button>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <CalendarClock className="size-3.5" />
          Đơn mới
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">
          Tạo đơn nghỉ phép
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chọn thời gian nghỉ và cung cấp thông tin cần thiết cho người duyệt.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="shadow-sm motion-panel">
          <CardHeader className="border-b">
            <CardTitle>Thông tin đơn nghỉ</CardTitle>
            <CardDescription>
              Kiểm tra kỹ khoảng ngày trước khi gửi đơn.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <LeaveRequestForm
              isSubmitting={createLeaveRequest.isPending}
              error={formError}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>

        <aside className="grid gap-3 self-start">
          {guidance.map((item, index) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.text}
                className="motion-card bg-card/95 shadow-sm"
                style={{ "--motion-index": index } as CSSProperties}
              >
                <CardContent className="flex gap-3 pt-0">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-950/5 text-teal-950 dark:bg-teal-100/10 dark:text-teal-200">
                    <Icon className="size-4" />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.text}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
