"use client";

import { ArrowLeft, CircleCheck, FilePlus2, Sparkles } from "lucide-react";
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
import { TicketForm } from "@/features/tickets/components/ticket-form";
import { useCreateTicket } from "@/features/tickets/hooks";
import {
  toTicketPayload,
  type TicketFormValues,
} from "@/features/tickets/schemas";
import { getApiErrorMessage } from "@/lib/axios";

export default function NewTicketPage() {
  const router = useRouter();
  const createTicket = useCreateTicket();
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(values: TicketFormValues) {
    setFormError(null);

    try {
      const ticket = await createTicket.mutateAsync(toTicketPayload(values));
      router.push(`/tickets/${ticket.id}`);
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, "Không thể tạo ticket. Vui lòng thử lại."),
      );
    }
  }

  return (
    <div className="grid gap-6 motion-enter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-2 mb-2">
            <Link href="/tickets">
              <ArrowLeft className="size-4" />
              Quay lại
            </Link>
          </Button>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <FilePlus2 className="size-3.5" />
            Ticket mới
          </div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Tạo ticket mới
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gửi yêu cầu hỗ trợ nội bộ tới đội phụ trách.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="shadow-sm motion-panel">
          <CardHeader className="border-b">
            <CardTitle>Thông tin ticket</CardTitle>
            <CardDescription>
              Tiêu đề và mô tả càng rõ thì thời gian xử lý càng nhanh.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TicketForm
              submitLabel="Tạo ticket"
              isSubmitting={createTicket.isPending}
              error={formError}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>

        <aside className="grid gap-4 self-start">
          {[
            {
              icon: Sparkles,
              text: "Mô tả lỗi, thời điểm xảy ra và mức độ ảnh hưởng.",
            },
            {
              icon: CircleCheck,
              text: "Chọn độ ưu tiên phù hợp để đội IT sắp xếp xử lý.",
            },
            {
              icon: FilePlus2,
              text: "Ticket mới sẽ ở trạng thái Mở sau khi tạo.",
            },
          ].map((item, index) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.text}
                className="motion-card bg-card/95 shadow-sm"
                style={{ "--motion-index": index } as CSSProperties}
              >
                <CardContent className="flex gap-3 pt-0">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-950/5 text-teal-950">
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
