import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type {
  CreateLeaveRequestInput,
  GetLeaveRequestsParams,
  LeaveRequest,
  LeaveRequestsList,
  RejectLeaveRequestInput,
} from "./types";

export async function getMyLeaveRequestsApi(
  params: GetLeaveRequestsParams = {},
) {
  const res = await api.get<ApiResponse<LeaveRequestsList>>(
    "/leave-request/me",
    { params },
  );

  return res.data.data;
}

export async function getPendingLeaveRequestsApi(
  params: Pick<GetLeaveRequestsParams, "page" | "limit"> = {},
) {
  const res = await api.get<ApiResponse<LeaveRequestsList>>(
    "/leave-request/pending-approval",
    { params },
  );

  return res.data.data;
}

export async function getLeaveRequestApi(id: number) {
  const res = await api.get<ApiResponse<LeaveRequest>>(`/leave-request/${id}`);
  return res.data.data;
}

export async function createLeaveRequestApi(input: CreateLeaveRequestInput) {
  const res = await api.post<ApiResponse<LeaveRequest>>(
    "/leave-request",
    input,
  );

  return res.data.data;
}

export async function approveLeaveRequestApi(id: number) {
  const res = await api.patch<ApiResponse<LeaveRequest>>(
    `/leave-request/${id}/approve`,
  );

  return res.data.data;
}

export async function rejectLeaveRequestApi(
  id: number,
  input: RejectLeaveRequestInput,
) {
  const res = await api.patch<ApiResponse<LeaveRequest>>(
    `/leave-request/${id}/reject`,
    input,
  );

  return res.data.data;
}

export async function cancelLeaveRequestApi(id: number) {
  const res = await api.patch<ApiResponse<LeaveRequest>>(
    `/leave-request/${id}/cancel`,
  );

  return res.data.data;
}
