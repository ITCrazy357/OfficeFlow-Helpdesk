import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HelpCircle,
  TimerReset,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import {
  getPriorityMeta,
  getSlaMeta,
  getTicketSlaState,
  getStatusMeta,
} from "../constants";
import type {
  Ticket,
  TicketPriority,
  TicketSlaState,
  TicketStatus,
} from "../types";

const slaIcons = {
  NO_DEADLINE: HelpCircle,
  ON_TRACK: CheckCircle2,
  DUE_SOON: Clock3,
  OVERDUE: AlertTriangle,
  DONE: TimerReset,
} satisfies Record<TicketSlaState, typeof HelpCircle>;

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const meta = getStatusMeta(status);

  return (
    <Badge
      variant="outline"
      className={cn("motion-badge", meta?.className)}
    >
      {meta?.label ?? status}
    </Badge>
  );
}

export function TicketPriorityBadge({
  priority,
}: {
  priority: TicketPriority;
}) {
  const meta = getPriorityMeta(priority);

  return (
    <Badge
      variant="outline"
      className={cn("motion-badge", meta?.className)}
    >
      {meta?.label ?? priority}
    </Badge>
  );
}

export function TicketSlaBadge({
  ticket,
  state,
}: {
  ticket?: Pick<Ticket, "status" | "dueAt" | "dueDate" | "isOverdue">;
  state?: TicketSlaState;
}) {
  const slaState = state ?? (ticket ? getTicketSlaState(ticket) : "NO_DEADLINE");
  const meta = getSlaMeta(slaState);
  const Icon = slaIcons[slaState];

  return (
    <Badge
      variant="outline"
      className={cn("motion-badge", meta.className)}
    >
      <Icon className="size-3.5" />
      {meta.label}
    </Badge>
  );
}
