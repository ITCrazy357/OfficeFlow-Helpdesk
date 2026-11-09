"use client";

import { MailCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ticketStatusOptions } from "../constants";
import { canTransitionTicket, isTerminalTicket } from "../status-policy";
import type { Ticket } from "../types";

type TicketStatusPanelProps = {
  ticket: Ticket;
  isPending: boolean;
  error: string | null;
  assigneesReady: boolean;
  hasEligibleAssignee: boolean;
  onStatusChange: (status: string) => void;
};

export function TicketStatusPanel({
  ticket,
  isPending,
  error,
  assigneesReady,
  hasEligibleAssignee,
  onStatusChange,
}: TicketStatusPanelProps) {
  return (
    <Card className="shadow-sm motion-panel">
      <CardHeader className="border-b">
        <CardTitle>Cập nhật trạng thái</CardTitle>
        <CardDescription>
          ADMIN và IT_STAFF có quyền đổi trạng thái.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0">
        <Select
          value={ticket.status}
          onValueChange={onStatusChange}
          disabled={isPending || isTerminalTicket(ticket.status)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Chọn trạng thái" />
          </SelectTrigger>
          <SelectContent>
            {ticketStatusOptions
              .filter(
                (status) =>
                  status.value !== "CLOSED" &&
                  canTransitionTicket(ticket.status, status.value),
              )
              .map((status) => (
                <SelectItem
                  key={status.value}
                  value={status.value}
                  disabled={
                    status.value !== ticket.status &&
                    status.value === "IN_PROGRESS" &&
                    Boolean(ticket.assignedTo) &&
                    assigneesReady &&
                    !hasEligibleAssignee
                  }
                >
                  <span className="flex items-center gap-2">
                    {status.label}
                    {status.value === "RESOLVED" ? (
                      <MailCheck
                        className="size-3.5 text-emerald-700 dark:text-emerald-200"
                        aria-label="Có email thông báo"
                      />
                    ) : null}
                  </span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {isTerminalTicket(ticket.status) ? (
          <p className="text-sm text-muted-foreground">
            Ticket đã đóng hoặc hủy, không thể đổi trạng thái tiếp.
          </p>
        ) : null}
        {ticket.assignedTo &&
        assigneesReady &&
        !hasEligibleAssignee &&
        !isTerminalTicket(ticket.status) ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Người phụ trách hiện không đủ điều kiện. Hãy giao lại ticket trước
            khi chuyển sang Đang xử lý.
          </p>
        ) : null}
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200/80 dark:border-emerald-400/25 bg-emerald-50/70 dark:bg-emerald-400/10 p-3 text-xs leading-5 text-emerald-900 dark:text-emerald-200">
          <MailCheck className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Chuyển sang Đã xử lý sẽ gửi email kết quả cho người tạo nếu tính
            năng email đang bật.
          </p>
        </div>
        {error ? (
          <p className="text-sm font-medium text-destructive">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
