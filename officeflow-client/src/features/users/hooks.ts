import { useQuery } from "@tanstack/react-query";
import { getUsersApi } from "./api";

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
