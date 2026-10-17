import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  getAssetCareOverview,
  getAssetMaintenance,
  saveAssetMaintenance,
} from "./care-api";
import type { MaintenanceCommand, MaintenanceParams } from "./types";

export const assetCareKeys = {
  all: ["assets", "care"] as const,
  overview: ["assets", "care", "overview"] as const,
  maintenance: (id: number, params: MaintenanceParams) =>
    ["assets", "care", "maintenance", id, params] as const,
};

function useCareQuery<T>(
  key: QueryKey,
  load: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
) {
  const cache = useQueryClient();
  return useQuery({
    queryKey: key,
    enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        return await load(signal);
      } catch (error) {
        if (
          isAxiosError(error) &&
          [401, 403].includes(error.response?.status ?? 0)
        )
          cache.setQueriesData({ queryKey: assetCareKeys.all }, null);
        throw error;
      }
    },
  });
}

export function useAssetCareOverview() {
  return useCareQuery(assetCareKeys.overview, getAssetCareOverview, true);
}
export function useAssetMaintenance(
  assetId: number,
  params: MaintenanceParams,
) {
  return useCareQuery(
    assetCareKeys.maintenance(assetId, params),
    (signal) => getAssetMaintenance(assetId, params, signal),
    assetId > 0,
  );
}
export function useSaveAssetMaintenance(assetId: number) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (command: MaintenanceCommand) =>
      saveAssetMaintenance(assetId, command),
    onSettled: () => cache.invalidateQueries({ queryKey: ["assets"] }),
  });
}
