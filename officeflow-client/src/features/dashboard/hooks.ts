import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  getDashboardSlaOverviewApi,
  getDashboardSummaryApi,
  getTicketsByCategoryApi,
  getTicketsByDepartmentApi,
  getTicketsByPriorityApi,
  getTicketsByStatusApi,
  getDashboardPerformanceApi,
} from "./api";
import type { PerformanceDates } from "./types";

export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  performance: (dates: PerformanceDates) =>
    [...dashboardQueryKeys.all, "performance", dates] as const,
  summary: () => [...dashboardQueryKeys.all, "summary"] as const,
  status: () => [...dashboardQueryKeys.all, "tickets-by-status"] as const,
  priority: () => [...dashboardQueryKeys.all, "tickets-by-priority"] as const,
  category: () => [...dashboardQueryKeys.all, "tickets-by-category"] as const,
  department: () =>
    [...dashboardQueryKeys.all, "tickets-by-department"] as const,
  slaOverview: () => [...dashboardQueryKeys.all, "sla-overview"] as const,
};

export function useDashboardPerformance(dates: PerformanceDates) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: dashboardQueryKeys.performance(dates),
    queryFn: async ({ signal }) => {
      try {
        return {
          report: await getDashboardPerformanceApi(dates, signal),
          accessError: null,
        };
      } catch (error) {
        if (
          isAxiosError(error) &&
          [401, 403].includes(error.response?.status ?? 0)
        ) {
          // Replace cached private data on definitive access loss. A later 503
          // must not bring back the report from before access was denied.
          const denied = { report: null, accessError: error };
          queryClient.setQueriesData(
            { queryKey: [...dashboardQueryKeys.all, "performance"] },
            denied,
          );
          return denied;
        }
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: getDashboardSummaryApi,
  });
}

export function useTicketsByStatusReport() {
  return useQuery({
    queryKey: dashboardQueryKeys.status(),
    queryFn: getTicketsByStatusApi,
  });
}

export function useTicketsByPriorityReport() {
  return useQuery({
    queryKey: dashboardQueryKeys.priority(),
    queryFn: getTicketsByPriorityApi,
  });
}

export function useTicketsByCategoryReport() {
  return useQuery({
    queryKey: dashboardQueryKeys.category(),
    queryFn: getTicketsByCategoryApi,
  });
}

export function useTicketsByDepartmentReport() {
  return useQuery({
    queryKey: dashboardQueryKeys.department(),
    queryFn: getTicketsByDepartmentApi,
  });
}

export function useDashboardSlaOverview() {
  return useQuery({
    queryKey: dashboardQueryKeys.slaOverview(),
    queryFn: getDashboardSlaOverviewApi,
  });
}
