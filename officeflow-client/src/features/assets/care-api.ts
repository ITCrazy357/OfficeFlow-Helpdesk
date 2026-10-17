import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type {
  AssetCareOverview,
  AssetMaintenance,
  MaintenanceCommand,
  MaintenanceList,
  MaintenanceParams,
} from "./types";

export async function getAssetCareOverview(signal?: AbortSignal) {
  return (
    await api.get<ApiResponse<AssetCareOverview>>("/assets/care-overview", {
      signal,
    })
  ).data.data;
}

export async function getAssetMaintenance(
  assetId: number,
  params: MaintenanceParams,
  signal?: AbortSignal,
) {
  return (
    await api.get<ApiResponse<MaintenanceList>>(
      `/assets/${assetId}/maintenance`,
      { params, signal },
    )
  ).data.data;
}

export async function saveAssetMaintenance(
  assetId: number,
  command: MaintenanceCommand,
) {
  const path = `/assets/${assetId}/maintenance`;
  if (command.action === "create")
    return (await api.post<ApiResponse<AssetMaintenance>>(path, command.input))
      .data.data;
  const suffix = command.action === "update" ? "" : `/${command.action}`;
  return (
    await api.patch<ApiResponse<AssetMaintenance>>(
      `${path}/${command.id}${suffix}`,
      command.input,
    )
  ).data.data;
}
