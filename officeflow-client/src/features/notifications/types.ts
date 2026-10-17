import type { PaginatedData } from "@/types/api";

export type NotificationType =
  | "TICKET_ASSIGNED"
  | "TICKET_COMMENTED"
  | "TICKET_STATUS_CHANGED"
  | "TICKET_OVERDUE"
  | "TICKET_SLA_WARNING"
  | "TICKET_RESPONSE_OVERDUE"
  | "TICKET_SLA_ESCALATED"
  | "KNOWLEDGE_PUBLISHED"
  | "ASSET_ASSIGNED"
  | "ASSET_RETURNED"
  | "ASSET_WARRANTY_EXPIRING"
  | "LEAVE_REQUESTED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_CANCELLED";

export type NotificationItem = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  targetUrl?: string | null;
  isRead: boolean;
  createdAt: string;
};

export type GetNotificationsParams = {
  page?: number;
  limit?: number;
  isRead?: boolean;
};

export type NotificationsList = PaginatedData<NotificationItem>;

export type MarkAllNotificationsReadResponse = {
  updatedCount: number;
};

export type DeleteNotificationResponse = {
  id: number;
};
