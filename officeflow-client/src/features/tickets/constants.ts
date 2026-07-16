import type { TicketPriority, TicketStatus } from "./types";

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
