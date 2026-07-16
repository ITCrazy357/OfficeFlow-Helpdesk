import { useQuery } from "@tanstack/react-query";
import { getDbHealthApi, getHealthApi } from "./api";

export const systemQueryKeys = {
  health: ["system", "health"] as const,
  dbHealth: ["system", "db-health"] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: systemQueryKeys.health,
    queryFn: getHealthApi,
    retry: false,
  });
}

export function useDbHealth() {
  return useQuery({
    queryKey: systemQueryKeys.dbHealth,
    queryFn: getDbHealthApi,
    retry: false,
  });
}
