import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authQueryKeys } from "@/features/auth/hooks";

import {
  changeUserStatusApi,
  createUserApi,
  getUsersApi,
  resetUserPasswordApi,
  updateUserApi,
} from "./api";
import type {
  ChangeUserStatusInput,
  ResetUserPasswordInput,
  UpdateUserInput,
} from "./types";

export const usersQueryKeys = {
  all: ["users"] as const,
  itStaff: ["users", "it-staff"] as const,
};

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: usersQueryKeys.all,
    queryFn: getUsersApi,
    enabled,
    retry: false,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUserApi,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateUserInput }) =>
      updateUserApi(id, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: authQueryKeys.me }),
      ]),
  });
}

export function useChangeUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ChangeUserStatusInput }) =>
      changeUserStatusApi(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: ResetUserPasswordInput;
    }) => resetUserPasswordApi(id, input),
  });
}

export function useItStaffUsers(enabled = true) {
  return useQuery({
    queryKey: usersQueryKeys.itStaff,
    queryFn: getUsersApi,
    enabled,
    retry: false,
    select: (users) =>
      users.filter((user) => user.role === "IT_STAFF" && user.isActive),
  });
}
