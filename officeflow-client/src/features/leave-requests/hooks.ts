import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  approveLeaveRequestApi,
  cancelLeaveRequestApi,
  createLeaveRequestApi,
  getLeaveRequestApi,
  getMyLeaveRequestsApi,
  getPendingLeaveRequestsApi,
  rejectLeaveRequestApi,
} from "./api";
import type {
  CreateLeaveRequestInput,
  GetLeaveRequestsParams,
  LeaveRequest,
  RejectLeaveRequestInput,
} from "./types";

export const leaveRequestsQueryKeys = {
  all: ["leave-requests"] as const,
  mine: () => [...leaveRequestsQueryKeys.all, "mine"] as const,
  mineList: (params: GetLeaveRequestsParams) =>
    [...leaveRequestsQueryKeys.mine(), params] as const,
  pending: () => [...leaveRequestsQueryKeys.all, "pending-approval"] as const,
  pendingList: (params: Pick<GetLeaveRequestsParams, "page" | "limit">) =>
    [...leaveRequestsQueryKeys.pending(), params] as const,
  details: () => [...leaveRequestsQueryKeys.all, "detail"] as const,
  detail: (id: number) => [...leaveRequestsQueryKeys.details(), id] as const,
};

function updateLeaveRequestCaches(
  queryClient: QueryClient,
  leaveRequest: LeaveRequest,
) {
  queryClient.setQueryData(
    leaveRequestsQueryKeys.detail(leaveRequest.id),
    leaveRequest,
  );
  queryClient.invalidateQueries({ queryKey: leaveRequestsQueryKeys.mine() });
  queryClient.invalidateQueries({
    queryKey: leaveRequestsQueryKeys.pending(),
  });
}

export function useMyLeaveRequests(
  params: GetLeaveRequestsParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: leaveRequestsQueryKeys.mineList(params),
    queryFn: () => getMyLeaveRequestsApi(params),
    enabled,
  });
}

export function usePendingLeaveRequests(
  params: Pick<GetLeaveRequestsParams, "page" | "limit"> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: leaveRequestsQueryKeys.pendingList(params),
    queryFn: () => getPendingLeaveRequestsApi(params),
    enabled,
    retry: false,
  });
}

export function useLeaveRequest(id: number, enabled = true) {
  return useQuery({
    queryKey: leaveRequestsQueryKeys.detail(id),
    queryFn: () => getLeaveRequestApi(id),
    enabled,
    retry: false,
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) =>
      createLeaveRequestApi(input),
    onSuccess: (leaveRequest) => {
      queryClient.setQueryData(
        leaveRequestsQueryKeys.detail(leaveRequest.id),
        leaveRequest,
      );
      queryClient.invalidateQueries({
        queryKey: leaveRequestsQueryKeys.mine(),
      });
    },
  });
}

export function useApproveLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => approveLeaveRequestApi(id),
    onSuccess: (leaveRequest) => {
      updateLeaveRequestCaches(queryClient, leaveRequest);
    },
  });
}

export function useRejectLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RejectLeaveRequestInput }) =>
      rejectLeaveRequestApi(id, input),
    onSuccess: (leaveRequest) => {
      updateLeaveRequestCaches(queryClient, leaveRequest);
    },
  });
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => cancelLeaveRequestApi(id),
    onSuccess: (leaveRequest) => {
      updateLeaveRequestCaches(queryClient, leaveRequest);
    },
  });
}
