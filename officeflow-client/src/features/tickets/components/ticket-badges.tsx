import { Badge } from "@/shared/components/ui/badge";
import type { TicketPriority, TicketStatus } from "@/features/tickets/types";

const statusTone: Record<TicketStatus, "neutral" | "blue" | "green" | "amber" | "red"> = {
  OPEN: "blue",
  IN_PROGRESS: "amber",
  RESOLVED: "green",
  CLOSED: "neutral",
  CANCELLED: "red",
};

const priorityTone: Record<TicketPriority, "neutral" | "blue" | "amber" | "red"> = {
  LOW: "neutral",
  MEDIUM: "blue",
  HIGH: "amber",
  URGENT: "red",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge tone={statusTone[status]}>{status}</Badge>;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge tone={priorityTone[priority]}>{priority}</Badge>;
}

