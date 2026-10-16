import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSlaPolicyApi, updateSlaPolicyApi } from "./api";

export const slaPolicyQueryKey = ["sla", "policy"] as const;

export function useSlaPolicy(enabled = true) {
  return useQuery({
    queryKey: slaPolicyQueryKey,
    queryFn: getSlaPolicyApi,
    enabled,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useUpdateSlaPolicy() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateSlaPolicyApi,
    onSuccess: (policy) => {
      client.setQueryData(slaPolicyQueryKey, policy);
      client.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}
