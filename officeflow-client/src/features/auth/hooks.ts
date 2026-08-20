import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { removeAccessToken, setAccessToken } from "@/lib/token";
import {
  changePasswordApi,
  getMeApi,
  loginApi,
  logoutAllApi,
  logoutApi,
} from "./api";

export const authQueryKeys = {
  me: ["auth", "me"] as const,
};

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      queryClient.setQueryData(authQueryKeys.me, data.user);
    },
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: authQueryKeys.me,
    queryFn: getMeApi,
    enabled,
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      removeAccessToken();
      queryClient.clear();
    }
  }, [queryClient]);
}

export function useLogoutAll() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await logoutAllApi();
    removeAccessToken();
    queryClient.clear();
  }, [queryClient]);
}

export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: changePasswordApi,
    onSuccess: () => {
      removeAccessToken();
      queryClient.clear();
    },
  });
}
