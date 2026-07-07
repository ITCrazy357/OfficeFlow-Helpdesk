import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { removeAccessToken, setAccessToken } from "@/lib/token";
import { getMeApi, loginApi, registerApi } from "./api";

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

export function useRegister() {
  return useMutation({
    mutationFn: registerApi,
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

  return useCallback(() => {
    removeAccessToken();
    queryClient.clear();
  }, [queryClient]);
}
