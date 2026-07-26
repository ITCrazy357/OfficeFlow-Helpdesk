import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  deleteNotificationApi,
  getNotificationsApi,
  getUnreadNotificationCountApi,
  markAllNotificationsAsReadApi,
  markNotificationAsReadApi,
} from "./api";
import type { GetNotificationsParams, NotificationsList } from "./types";

export const notificationsQueryKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationsQueryKeys.all, "list"] as const,
  list: (params: GetNotificationsParams) =>
    [...notificationsQueryKeys.lists(), params] as const,
  unreadCount: () => [...notificationsQueryKeys.all, "unread-count"] as const,
};

type NotificationQueryOptions = {
  enabled?: boolean;
  refetchInterval?: number | false;
};

function wasCachedNotificationUnread(queryClient: QueryClient, id: number) {
  return queryClient
    .getQueriesData<NotificationsList>({
      queryKey: notificationsQueryKeys.lists(),
    })
    .some(([, data]) =>
      data?.items.some(
        (notification) => notification.id === id && !notification.isRead,
      ),
    );
}

function updateCachedNotificationReadState(
  queryClient: QueryClient,
  id: number,
  isRead: boolean,
) {
  queryClient.setQueriesData<NotificationsList>(
    { queryKey: notificationsQueryKeys.lists() },
    (current) =>
      current
        ? {
            ...current,
            items: current.items.map((notification) =>
              notification.id === id
                ? { ...notification, isRead }
                : notification,
            ),
          }
        : current,
  );
}

function markCachedNotificationsAsRead(queryClient: QueryClient) {
  queryClient.setQueriesData<NotificationsList>(
    { queryKey: notificationsQueryKeys.lists() },
    (current) =>
      current
        ? {
            ...current,
            items: current.items.map((notification) => ({
              ...notification,
              isRead: true,
            })),
          }
        : current,
  );
}

function removeCachedNotification(queryClient: QueryClient, id: number) {
  queryClient.setQueriesData<NotificationsList>(
    { queryKey: notificationsQueryKeys.lists() },
    (current) =>
      current
        ? {
            ...current,
            items: current.items.filter((notification) => notification.id !== id),
            pagination: {
              ...current.pagination,
              totalItems: Math.max(current.pagination.totalItems - 1, 0),
            },
          }
        : current,
  );
}

export function useNotifications(
  params: GetNotificationsParams = {},
  options: NotificationQueryOptions = {},
) {
  return useQuery({
    queryKey: notificationsQueryKeys.list(params),
    queryFn: () => getNotificationsApi(params),
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
  });
}

export function useUnreadNotificationCount(
  options: NotificationQueryOptions = {},
) {
  return useQuery({
    queryKey: notificationsQueryKeys.unreadCount(),
    queryFn: getUnreadNotificationCountApi,
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => markNotificationAsReadApi(id),
    onSuccess: (_, id) => {
      const wasUnread = wasCachedNotificationUnread(queryClient, id);

      updateCachedNotificationReadState(queryClient, id, true);

      if (wasUnread) {
        queryClient.setQueryData<number>(
          notificationsQueryKeys.unreadCount(),
          (current) => Math.max((current ?? 1) - 1, 0),
        );
      }

      queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.all });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsAsReadApi,
    onSuccess: () => {
      markCachedNotificationsAsRead(queryClient);
      queryClient.setQueryData(notificationsQueryKeys.unreadCount(), 0);
      queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteNotificationApi(id),
    onSuccess: (deleted, id) => {
      const deletedId = deleted.id ?? id;
      const wasUnread = wasCachedNotificationUnread(queryClient, deletedId);

      removeCachedNotification(queryClient, deletedId);

      if (wasUnread) {
        queryClient.setQueryData<number>(
          notificationsQueryKeys.unreadCount(),
          (current) => Math.max((current ?? 1) - 1, 0),
        );
      }

      queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.all });
    },
  });
}
