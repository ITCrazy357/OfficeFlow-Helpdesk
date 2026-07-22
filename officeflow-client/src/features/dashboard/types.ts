import type { TicketPriority, TicketStatus } from "@/features/tickets/types";

export type DashboardSummary = {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  overdueTickets: number;
};

export type DashboardStatusReportItem = {
  status: TicketStatus;
  total: number;
};

export type DashboardPriorityReportItem = {
  priority: TicketPriority;
  total: number;
};

export type DashboardCategoryReportItem = {
  categoryId: number | null;
  categoryName: string;
  total: number;
};

export type DashboardDepartmentReportItem = {
  departmentId: number;
  departmentName: string;
  total: number;
};

export type DashboardSlaOverview = {
  totalTickets: number;
  overdueTickets: number;
  resolvedTickets: number;
  overdueRate: number;
};
