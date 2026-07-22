import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type {
  DashboardCategoryReportItem,
  DashboardDepartmentReportItem,
  DashboardPriorityReportItem,
  DashboardSlaOverview,
  DashboardStatusReportItem,
  DashboardSummary,
} from "./types";

function keepValidRows<T extends { total: number }>(rows: Array<T | null>) {
  return rows.filter(
    (row): row is T => Boolean(row) && typeof row?.total === "number",
  );
}

export async function getDashboardSummaryApi() {
  const res = await api.get<ApiResponse<DashboardSummary>>(
    "/dashboard/summary",
  );

  return res.data.data;
}

export async function getTicketsByStatusApi() {
  const res = await api.get<ApiResponse<DashboardStatusReportItem[]>>(
    "/dashboard/tickets-by-status",
  );

  return keepValidRows(res.data.data ?? []);
}

export async function getTicketsByPriorityApi() {
  const res = await api.get<ApiResponse<Array<DashboardPriorityReportItem | null>>>(
    "/dashboard/tickets-by-priority",
  );

  return keepValidRows(res.data.data ?? []);
}

export async function getTicketsByCategoryApi() {
  const res = await api.get<ApiResponse<DashboardCategoryReportItem[]>>(
    "/dashboard/tickets-by-category",
  );

  return keepValidRows(res.data.data ?? []);
}

export async function getTicketsByDepartmentApi() {
  const res = await api.get<ApiResponse<DashboardDepartmentReportItem[]>>(
    "/dashboard/tickets-by-department",
  );

  return keepValidRows(res.data.data ?? []);
}

export async function getDashboardSlaOverviewApi() {
  const res = await api.get<ApiResponse<DashboardSlaOverview>>(
    "/dashboard/sla-overview",
  );

  return res.data.data;
}
