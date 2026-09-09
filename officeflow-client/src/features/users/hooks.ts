import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { authQueryKeys } from "@/features/auth/hooks";

import {
  changeAccountLockApi,
  changeUserStatusApi,
  createUserApi,
  getUsersApi,
  resetUserPasswordApi,
  updateUserApi,
  handoffUserApi,
} from "./api";
import type {
  ChangeAccountLockInput,
  ChangeUserStatusInput,
  ResetUserPasswordInput,
  UpdateUserInput,
  HandoffUserInput,
} from "./types";

export const usersQueryKeys = {
  all: ["users"] as const,
};

function refreshUserLifecycle(queryClient: QueryClient) {
  // Refresh on errors too: a conflict may mean another ADMIN changed eligibility.
  return Promise.all(
    [
      usersQueryKeys.all,
      authQueryKeys.me,
      ["leave-requests"],
      ["tickets"],
      ["assets"],
      ["dashboard"],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

export function useHandoffUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: HandoffUserInput }) =>
      handoffUserApi(id, input),
    onSettled: () => refreshUserLifecycle(queryClient),
  });
}

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
    onSettled: () => refreshUserLifecycle(queryClient),
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
    onSettled: () => refreshUserLifecycle(queryClient),
  });
}

export function useChangeUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ChangeUserStatusInput }) =>
      changeUserStatusApi(id, input),
    onSettled: () => refreshUserLifecycle(queryClient),
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
