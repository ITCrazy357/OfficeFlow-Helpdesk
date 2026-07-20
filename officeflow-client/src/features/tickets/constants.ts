import type {
  Ticket,
  TicketPriority,
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
    className: "border-teal-200 bg-teal-50 text-teal-800",
  },
  {
    value: "IN_PROGRESS",
    label: "Đang xử lý",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    value: "RESOLVED",
    label: "Đã xử lý",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    value: "CLOSED",
    label: "Đã đóng",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    value: "CANCELLED",
    label: "Đã hủy",
    className: "border-red-200 bg-red-50 text-red-700",
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
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    value: "MEDIUM",
    label: "Trung bình",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  {
    value: "HIGH",
    label: "Cao",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    value: "URGENT",
    label: "Khẩn cấp",
    className: "border-red-200 bg-red-50 text-red-700",
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
  value: "ALL" | "ON_TRACK" | "OVERDUE";
  label: string;
}> = [
  { value: "ALL", label: "Tất cả SLA" },
  { value: "ON_TRACK", label: "Trong hạn" },
  { value: "OVERDUE", label: "Quá hạn" },
];

export function getTicketDueAt(ticket: Pick<Ticket, "dueAt" | "dueDate">) {
  return ticket.dueAt ?? ticket.dueDate ?? null;
}

export function isTicketTerminal(status: TicketStatus) {
  return terminalStatuses.includes(status);
}

export function getTicketSlaState(
  ticket: Pick<Ticket, "status" | "dueAt" | "dueDate" | "isOverdue">,
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

  if (remainingMs <= SLA_SOON_THRESHOLD_MS) {
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
      className: "border-slate-200 bg-slate-50 text-slate-700",
      description: "Ticket chưa có hạn xử lý.",
    },
    ON_TRACK: {
      label: "Còn hạn",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      description: "Ticket vẫn đang trong hạn SLA.",
    },
    DUE_SOON: {
      label: "Sắp quá hạn",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      description: "Ticket sắp chạm hạn SLA trong 24 giờ.",
    },
    OVERDUE: {
      label: "Đã quá hạn",
      className: "border-red-200 bg-red-50 text-red-700",
      description: "Ticket đã quá hạn xử lý theo SLA.",
    },
    DONE: {
      label: "Đã hoàn tất",
      className: "border-teal-200 bg-teal-50 text-teal-800",
      description: "Ticket đã kết thúc trước khi bị đánh dấu quá hạn.",
    },
  };

  return meta[state];
}
