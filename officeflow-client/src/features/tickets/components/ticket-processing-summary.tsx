import { CalendarClock, CheckCircle2, Clock3, UserCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TicketSlaBadge } from "./ticket-badges";
import { getSlaMeta, getTicketDueAt, getTicketSlaState } from "../constants";
import { formatDateTime } from "../ticket-detail.utils";
import type { Ticket } from "../types";

export function TicketProcessingSummary({ ticket }: { ticket: Ticket }) {
  const dueAt = getTicketDueAt(ticket);
  const slaMeta = getSlaMeta(getTicketSlaState(ticket));
  const metaItems = [
    {
      label: "Người tạo",
      value: ticket.createdBy?.name ?? "-",
      icon: UserCircle,
    },
    {
      label: "Người xử lý",
      value: ticket.assignedTo?.name ?? "Chưa gán",
      icon: CheckCircle2,
    },
    {
      label: "Hạn xử lý",
      value: formatDateTime(dueAt),
      icon: Clock3,
    },
    ...(ticket.resolveAt
      ? [
          {
            label: "Hoàn tất lúc",
            value: formatDateTime(ticket.resolveAt),
            icon: CheckCircle2,
          },
        ]
      : []),
    {
      label: "Ngày tạo",
      value: formatDateTime(ticket.createdAt),
      icon: CalendarClock,
    },
  ];
  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b">
        <CardTitle>Thông tin xử lý</CardTitle>
        <CardDescription>Trạng thái, người xử lý và timeline.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">SLA</p>
            <p className="mt-1 text-sm font-semibold">{slaMeta.description}</p>
          </div>
          <TicketSlaBadge ticket={ticket} />
        </div>
        {metaItems.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="flex gap-3 rounded-lg border bg-muted/20 p-3"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-950/5 dark:bg-teal-200/10 text-teal-950 dark:text-teal-200">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 truncate text-sm font-semibold">
                  {item.value}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
