import type { PaginatedData } from "@/types/api";

export type LeaveRequestStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type LeaveRequestUser = {
  id: number;
  name: string;
};

export type LeaveType = "ANNUAL" | "UNPAID" | "SICK";
export type LeavePeriod = "FULL_DAY" | "MORNING" | "AFTERNOON";
export type LeaveDay = { date: string; halfDays: number };

export type LeaveRequest = {
  id: number;
  startDate: string;
  endDate: string;
  reason: string;
  type?: LeaveType | "LEGACY";
  period?: LeavePeriod;
  days?: LeaveDay[];
  status: LeaveRequestStatus;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  requester: LeaveRequestUser;
  approver: LeaveRequestUser;
  reviewedBy?: LeaveRequestUser | null;
};

export type GetLeaveRequestsParams = {
  page?: number;
  limit?: number;
  status?: LeaveRequestStatus;
};

export type LeaveRequestsList = PaginatedData<LeaveRequest>;

export type CreateLeaveRequestInput = {
  type?: LeaveType;
  period?: LeavePeriod;
  startDate: string;
  endDate: string;
  reason: string;
};

export type LeaveBalance = {
  userId: number;
  year: number;
  allowance: number | null;
  used: number;
  reserved: number;
  remaining: number | null;
  version: number;
  legacyRequests: number;
};
export type LeaveCalendarItem = Pick<
  LeaveRequest,
  "id" | "startDate" | "endDate" | "period" | "status" | "requester" | "days"
>;
export type LeaveCalendarData = {
  departmentId: number | null;
  items: LeaveCalendarItem[];
  totalItems: number;
  page: number;
  totalPages: number;
};
export type LeavePreviewInput = Pick<
  CreateLeaveRequestInput,
  "startDate" | "endDate" | "type" | "period"
>;
export type LeavePreview = {
  days: number;
  calendar: { timezone: string; workingDays: number[]; holidays: string[] };
  balances: LeaveBalance[];
};

export type RejectLeaveRequestInput = {
  reviewNote: string;
};
