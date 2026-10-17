import type {
  Ticket,
  TicketPriority,
  TicketSlaFilter,
  TicketSlaState,
  TicketStatus,
} from "./types";

export const ticketStatusOptions: Array<{
  value: TicketStatus;
  label: string;
  className: string;
}> = [
  {
    value: "OPEN",
    label: "Mở",
    className: "border-teal-200 dark:border-teal-400/25 bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-200",
  },
  {
    value: "IN_PROGRESS",
    label: "Đang xử lý",
    className: "border-sky-200 dark:border-sky-400/25 bg-sky-50 dark:bg-sky-400/10 text-sky-800 dark:text-sky-200",
  },
  {
    value: "RESOLVED",
    label: "Đã xử lý",
    className: "border-emerald-200 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-200",
  },
  {
    value: "CLOSED",
    label: "Đã đóng",
    className: "border-slate-200 dark:border-slate-400/25 bg-slate-50 dark:bg-slate-400/10 text-slate-700 dark:text-slate-200",
  },
  {
    value: "CANCELLED",
    label: "Đã hủy",
    className: "border-red-200 dark:border-red-400/25 bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-200",
  },
];

export const ticketPriorityOptions: Array<{
  value: TicketPriority;
  label: string;
  className: string;
}> = [
  {
    value: "LOW",
    label: "Thấp",
    className: "border-slate-200 dark:border-slate-400/25 bg-slate-50 dark:bg-slate-400/10 text-slate-700 dark:text-slate-200",
  },
  {
    value: "MEDIUM",
    label: "Trung bình",
    className: "border-blue-200 dark:border-blue-400/25 bg-blue-50 dark:bg-blue-400/10 text-blue-800 dark:text-blue-200",
  },
  {
    value: "HIGH",
    label: "Cao",
    className: "border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200",
  },
  {
    value: "URGENT",
    label: "Khẩn cấp",
    className: "border-red-200 dark:border-red-400/25 bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-200",
  },
];

export function getStatusMeta(status: TicketStatus) {
  return ticketStatusOptions.find((item) => item.value === status);
}

export function getPriorityMeta(priority: TicketPriority) {
  return ticketPriorityOptions.find((item) => item.value === priority);
}

const SLA_SOON_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const terminalStatuses: TicketStatus[] = ["RESOLVED", "CLOSED", "CANCELLED"];

export const ticketSlaOptions: Array<{
  value: "ALL" | TicketSlaFilter;
  label: string;
}> = [
  { value: "ALL", label: "Tất cả SLA" },
  { value: "ON_TRACK", label: "Còn hạn" },
  { value: "DUE_SOON", label: "Sắp quá hạn" },
  { value: "OVERDUE", label: "Quá hạn" },
];

export function getTicketDueAt(ticket: Pick<Ticket, "dueAt" | "dueDate">) {
  return ticket.dueAt ?? ticket.dueDate ?? null;
}

export function isTicketTerminal(status: TicketStatus) {
  return terminalStatuses.includes(status);
}

export function getTicketSlaState(
  ticket: Pick<
    Ticket,
    "status" | "dueAt" | "dueDate" | "isOverdue" | "resolutionWarningAt"
  >,
  now = new Date(),
): TicketSlaState {
  if (ticket.isOverdue) {
    return "OVERDUE";
  }

  if (isTicketTerminal(ticket.status)) {
    return "DONE";
  }

  const dueAt = getTicketDueAt(ticket);

  if (!dueAt) {
    return "NO_DEADLINE";
  }

  const dueTime = new Date(dueAt).getTime();

  if (Number.isNaN(dueTime)) {
    return "NO_DEADLINE";
  }

  const remainingMs = dueTime - now.getTime();

  if (remainingMs <= 0) {
    return "OVERDUE";
  }

  if (
    ticket.resolutionWarningAt
      ? new Date(ticket.resolutionWarningAt).getTime() <= now.getTime()
      : ticket.resolutionWarningAt === undefined &&
        remainingMs <= SLA_SOON_THRESHOLD_MS
  ) {
    return "DUE_SOON";
  }

  return "ON_TRACK";
}

export function getSlaMeta(state: TicketSlaState) {
  const meta: Record<
    TicketSlaState,
    { label: string; className: string; description: string }
  > = {
    NO_DEADLINE: {
      label: "Chưa có hạn",
      className: "border-slate-200 dark:border-slate-400/25 bg-slate-50 dark:bg-slate-400/10 text-slate-700 dark:text-slate-200",
      description: "Ticket chưa có hạn xử lý.",
    },
    ON_TRACK: {
      label: "Còn hạn",
      className: "border-emerald-200 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-200",
      description: "Ticket vẫn đang trong hạn SLA.",
    },
    DUE_SOON: {
      label: "Sắp quá hạn",
      className: "border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200",
      description: "Ticket đã đến thời điểm cảnh báo trước hạn SLA.",
    },
    OVERDUE: {
      label: "Đã quá hạn",
      className: "border-red-200 dark:border-red-400/25 bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-200",
      description: "Ticket đã quá hạn xử lý theo SLA.",
    },
    DONE: {
      label: "Đã hoàn tất",
      className: "border-teal-200 dark:border-teal-400/25 bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-200",
      description: "Ticket đã kết thúc trước khi bị đánh dấu quá hạn.",
    },
  };

  return meta[state];
}
