import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authQueryKeys } from "@/features/auth/hooks";
import type { AuthUser } from "@/features/auth/types";

import {
  changeAccountLockApi,
  changeUserStatusApi,
  createUserApi,
  getUsersApi,
  resetUserPasswordApi,
  updateUserApi,
} from "./api";
import type {
  ChangeAccountLockInput,
  ChangeUserStatusInput,
  ResetUserPasswordInput,
  UpdateUserInput,
} from "./types";

export const usersQueryKeys = {
  all: ["users"] as const,
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
    onSuccess: (_, variables) => {
      const currentUser = queryClient.getQueryData<AuthUser>(authQueryKeys.me);
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
      ];

      if (currentUser?.id === variables.id) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: authQueryKeys.me }),
        );
      }

      return Promise.all(invalidations);
    },
  });
}

export function useChangeAccountLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: ChangeAccountLockInput;
    }) => changeAccountLockApi(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
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

export function useTicketAssignees(enabled = true) {
  return useQuery({
    queryKey: usersQueryKeys.all,
    queryFn: getUsersApi,
    enabled,
    retry: false,
    select: (users) =>
      users.filter(
        (user) =>
          (user.role === "ADMIN" || user.role === "IT_STAFF") &&
          user.isActive &&
          !user.isLocked,
      ),
  });
}
