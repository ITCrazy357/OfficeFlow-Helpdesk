import {
  AlertTriangle,
  BookOpenText,
  PackageCheck,
  PackageMinus,
  MessageSquareText,
  RefreshCw,
  TicketCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "./types";

type NotificationMeta = {
  label: string;
  icon: LucideIcon;
  tone: string;
  iconTone: string;
};

export const notificationMeta: Record<NotificationType, NotificationMeta> = {
  TICKET_ASSIGNED: {
    label: "Ticket được gán",
    icon: TicketCheck,
    tone: "border-sky-200 bg-sky-50 text-sky-800",
    iconTone: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  TICKET_COMMENTED: {
    label: "Bình luận mới",
    icon: MessageSquareText,
    tone: "border-teal-200 bg-teal-50 text-teal-800",
    iconTone: "bg-teal-50 text-teal-800 ring-teal-100",
  },
  TICKET_STATUS_CHANGED: {
    label: "Đổi trạng thái",
    icon: RefreshCw,
    tone: "border-violet-200 bg-violet-50 text-violet-800",
    iconTone: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  TICKET_OVERDUE: {
    label: "Quá hạn SLA",
    icon: AlertTriangle,
    tone: "border-red-200 bg-red-50 text-red-800",
    iconTone: "bg-red-50 text-red-700 ring-red-100",
  },
  KNOWLEDGE_PUBLISHED: {
    label: "Knowledge Base",
    icon: BookOpenText,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    iconTone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  ASSET_ASSIGNED: {
    label: "Tài sản được cấp",
    icon: PackageCheck,
    tone: "border-sky-200 bg-sky-50 text-sky-800",
    iconTone: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  ASSET_RETURNED: {
    label: "Tài sản đã thu hồi",
    icon: PackageMinus,
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    iconTone: "bg-amber-50 text-amber-700 ring-amber-100",
  },
};

export function getNotificationMeta(type: NotificationType) {
  return notificationMeta[type] ?? notificationMeta.TICKET_ASSIGNED;
}

export function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatNotificationRelativeTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(diffInSeconds);
  const formatter = new Intl.RelativeTimeFormat("vi-VN", {
    numeric: "auto",
  });

  if (absoluteSeconds < 60) {
    return formatter.format(diffInSeconds, "second");
  }

  const diffInMinutes = Math.round(diffInSeconds / 60);

  if (Math.abs(diffInMinutes) < 60) {
    return formatter.format(diffInMinutes, "minute");
  }

  const diffInHours = Math.round(diffInMinutes / 60);

  if (Math.abs(diffInHours) < 24) {
    return formatter.format(diffInHours, "hour");
  }

  const diffInDays = Math.round(diffInHours / 24);

  if (Math.abs(diffInDays) < 7) {
    return formatter.format(diffInDays, "day");
  }

  return formatNotificationDate(value);
}
