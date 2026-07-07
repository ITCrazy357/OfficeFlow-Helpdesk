import { useQuery } from "@tanstack/react-query";
import { getDepartmentsApi } from "./api";

export const departmentsQueryKeys = {
  all: ["departments"] as const,
};

export function useDepartments() {
  return useQuery({
    queryKey: departmentsQueryKeys.all,
    queryFn: getDepartmentsApi,
  });
}
