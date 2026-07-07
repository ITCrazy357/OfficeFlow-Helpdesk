import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { getPriorityMeta, getStatusMeta } from "../constants";
import type { TicketPriority, TicketStatus } from "../types";

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
