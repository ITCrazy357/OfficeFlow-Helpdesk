import { useQuery } from "@tanstack/react-query";
import { getUsersApi } from "./api";

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
