import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type {
  LeaveBalance,
  LeaveCalendarData,
  LeavePreview,
  LeavePreviewInput,
} from "./types";

const keys = ["leave-requests", "planning"] as const;

export function useLeaveBalance(year: number, userId?: number) {
  const cache = useQueryClient();
  return useQuery({
    queryKey: [...keys, "balance", year, userId],
    enabled: Number.isInteger(year) && year >= 2000 && year <= 9998,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        const result = await api.get<ApiResponse<LeaveBalance>>(
          "/leave-request/balance",
          { params: { year, userId }, signal },
        );
        return result.data.data;
      } catch (error) {
        if (
          isAxiosError(error) &&
          [401, 403].includes(error.response?.status ?? 0)
        )
          cache.setQueriesData({ queryKey: keys }, null);
        throw error;
      }
    },
  });
}

export function useLeaveCalendar(
  month: string,
  page: number,
  departmentId?: number,
) {
  const cache = useQueryClient();
  return useQuery({
    queryKey: [...keys, "calendar", month, page, departmentId],
    enabled: /^\d{4}-\d{2}$/.test(month),
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        const result = await api.get<ApiResponse<LeaveCalendarData>>(
          "/leave-request/calendar",
          { params: { month, page, departmentId }, signal },
        );
        return result.data.data;
      } catch (error) {
        if (
          isAxiosError(error) &&
          [401, 403].includes(error.response?.status ?? 0)
        )
          cache.setQueriesData({ queryKey: keys }, null);
        throw error;
      }
    },
  });
}

export function useLeavePreview(input: LeavePreviewInput, enabled: boolean) {
  return useQuery({
    queryKey: [...keys, "preview", input],
    enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      const result = await api.post<ApiResponse<LeavePreview>>(
        "/leave-request/preview",
        input,
        { signal },
      );
      return result.data.data;
    },
  });
}

export function useSetLeaveEntitlement() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: number;
      year: number;
      days: number;
      version: number;
    }) => {
      const { userId, year, ...data } = input;
      const result = await api.put<ApiResponse<LeaveBalance>>(
        `/leave-request/entitlements/${userId}`,
        data,
        { params: { year } },
      );
      return result.data.data;
    },
    onSettled: () => cache.invalidateQueries({ queryKey: keys }),
  });
}
