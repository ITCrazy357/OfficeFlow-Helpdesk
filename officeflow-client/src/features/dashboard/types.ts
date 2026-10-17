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

export type PerformanceDates = { from: string; to: string };

export type DashboardPerformance = {
  range: PerformanceDates & { timezone: string };
  generatedAt: string;
  cohort: {
    total: number;
    completed: number;
    everCompleted: number;
    reopened: number;
    legacyCalendarTickets: number;
    reopenRate: number | null;
    firstResponse: { minutes: number | null; samples: number };
    resolution: { minutes: number | null; samples: number };
  };
  daily: Array<{ date: string; created: number; completed: number }>;
  backlog: Array<{ key: string; label: string; total: number }>;
};
