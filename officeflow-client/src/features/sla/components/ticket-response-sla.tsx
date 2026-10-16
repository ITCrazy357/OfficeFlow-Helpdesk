"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Ticket } from "@/features/tickets/types";
import { isTicketTerminal } from "@/features/tickets/constants";

export function TicketResponseSla({ ticket }: { ticket: Ticket }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (
      !ticket.firstResponseDueAt ||
      ticket.firstRespondedAt ||
      isTicketTerminal(ticket.status)
    )
      return;
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [ticket.firstResponseDueAt, ticket.firstRespondedAt, ticket.status]);
  if (!ticket.firstResponseDueAt) return null;
  const finishedWithoutReply =
    isTicketTerminal(ticket.status) && !ticket.firstRespondedAt;
  const responseTime = new Date(ticket.firstRespondedAt ?? now).getTime();
  const overdue =
    ticket.firstResponseOverdue ||
    (!finishedWithoutReply &&
      responseTime > new Date(ticket.firstResponseDueAt).getTime());
  const format = (value: string) =>
    new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(value));
  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA phản hồi đầu tiên</CardTitle>
        <CardDescription>
          Bình luận đầu tiên của ADMIN/IT khác người gửi yêu cầu.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 pt-0 text-sm">
        <p>Hạn phản hồi: {format(ticket.firstResponseDueAt)}</p>
        <p>
          {ticket.firstRespondedAt
            ? `Đã phản hồi: ${format(ticket.firstRespondedAt)}`
            : "Chưa có phản hồi từ đội hỗ trợ."}
        </p>
        <p
          className={
            overdue
              ? "font-medium text-destructive"
              : "font-medium text-foreground"
          }
        >
          {overdue
            ? "Đã quá hạn phản hồi"
            : ticket.firstRespondedAt
              ? "Phản hồi đúng hạn"
              : finishedWithoutReply
                ? "Ticket đã kết thúc"
                : "Đang trong hạn phản hồi"}
        </p>
      </CardContent>
    </Card>
  );
}
