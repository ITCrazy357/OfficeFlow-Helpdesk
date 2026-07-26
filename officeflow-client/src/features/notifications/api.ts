import { api } from "@/lib/axios";
import type { ApiResponse, Pagination } from "@/types/api";
import type {
  DeleteNotificationResponse,
  GetNotificationsParams,
  MarkAllNotificationsReadResponse,
  NotificationItem,
} from "./types";

type BackendNotificationsData = {
  data?: NotificationItem[];
  items?: NotificationItem[];
  pagination: Pagination;
};

export async function getNotificationsApi(
  params: GetNotificationsParams = {},
) {
  const res = await api.get<ApiResponse<BackendNotificationsData>>(
    "/notifications",
    { params },
  );

  const payload = res.data.data;

  return {
    items: payload.items ?? payload.data ?? [],
    pagination: payload.pagination,
  };
}

export async function getUnreadNotificationCountApi() {
  const res = await api.get<ApiResponse<number>>(
    "/notifications/unread-count",
  );

  return res.data.data;
}

export async function markNotificationAsReadApi(id: number) {
  const res = await api.patch<ApiResponse<NotificationItem>>(
    `/notifications/${id}/read`,
  );

  return res.data.data;
}

export async function markAllNotificationsAsReadApi() {
  const res = await api.patch<ApiResponse<MarkAllNotificationsReadResponse>>(
    "/notifications/read-all",
  );

  return res.data.data;
}

export async function deleteNotificationApi(id: number) {
  const res = await api.delete<ApiResponse<DeleteNotificationResponse>>(
    `/notifications/${id}`,
  );

  return res.data.data;
}
