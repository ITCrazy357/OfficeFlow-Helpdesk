import type { PaginatedData } from "@/types/api";

export type NotificationType =
  | "TICKET_ASSIGNED"
  | "TICKET_COMMENTED"
  | "TICKET_STATUS_CHANGED"
  | "TICKET_OVERDUE"
  | "KNOWLEDGE_PUBLISHED"
  | "ASSET_ASSIGNED"
  | "ASSET_RETURNED";

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
