import {
  Ban,
  CheckCircle2,
  Clock3,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import { leaveRequestStatusLabels } from "../constants";
import type { LeaveRequestStatus } from "../types";

const statusMeta: Record<
  LeaveRequestStatus,
  { icon: LucideIcon; className: string }
> = {
  PENDING: {
    icon: Clock3,
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  },
  APPROVED: {
    icon: CheckCircle2,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  REJECTED: {
    icon: XCircle,
    className:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200",
  },
  CANCELLED: {
    icon: Ban,
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  },
};

export function LeaveRequestStatusBadge({
  status,
  className,
}: {
  status: LeaveRequestStatus;
  className?: string;
}) {
  const meta = statusMeta[status];
  const Icon = meta.icon;

  return (
    <Badge
      variant="outline"
      className={cn("motion-badge", meta.className, className)}
    >
      <Icon className="size-3" />
      {leaveRequestStatusLabels[status]}
    </Badge>
  );
}
