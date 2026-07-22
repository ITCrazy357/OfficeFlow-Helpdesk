import { useQuery } from "@tanstack/react-query";
import {
  getDashboardSlaOverviewApi,
  getDashboardSummaryApi,
  getTicketsByCategoryApi,
  getTicketsByDepartmentApi,
  getTicketsByPriorityApi,
  getTicketsByStatusApi,
} from "./api";

export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardQueryKeys.all, "summary"] as const,
  status: () => [...dashboardQueryKeys.all, "tickets-by-status"] as const,
  priority: () => [...dashboardQueryKeys.all, "tickets-by-priority"] as const,
  category: () => [...dashboardQueryKeys.all, "tickets-by-category"] as const,
  department: () =>
    [...dashboardQueryKeys.all, "tickets-by-department"] as const,
  slaOverview: () => [...dashboardQueryKeys.all, "sla-overview"] as const,
};

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
