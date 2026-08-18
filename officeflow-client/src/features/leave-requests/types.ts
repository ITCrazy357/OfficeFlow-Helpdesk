import type { PaginatedData } from "@/types/api";

export type LeaveRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type LeaveRequestUser = {
  id: number;
  name: string;
};

export type LeaveRequest = {
  id: number;
  startDate: string;
  endDate: string;
  reason: string;
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
  startDate: string;
  endDate: string;
  reason: string;
};

export type RejectLeaveRequestInput = {
  reviewNote: string;
};
