import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";

import type {
  Asset,
  AssetAssignment,
  AssetsList,
  AssignAssetInput,
  AssignAssetResponse,
  ChangeAssetStatusInput,
  CreateAssetInput,
  GetAssetsParams,
  ReturnAssetInput,
  UpdateAssetInput,
} from "./types";

export async function getAssetsApi(params: GetAssetsParams = {}) {
  const response = await api.get<ApiResponse<AssetsList>>("/assets", {
    params,
  });

  return response.data.data;
}

export async function getMyAssetsApi() {
  const response = await api.get<ApiResponse<Asset[]>>("/assets/my");
  return response.data.data;
}

export async function getAssetApi(id: number) {
  const response = await api.get<ApiResponse<Asset>>(`/assets/${id}`);
  return response.data.data;
}

export async function createAssetApi(input: CreateAssetInput) {
  const response = await api.post<ApiResponse<Asset>>("/assets", input);
  return response.data.data;
}

export async function updateAssetApi(id: number, input: UpdateAssetInput) {
  const response = await api.patch<ApiResponse<Asset>>(`/assets/${id}`, input);
  return response.data.data;
}

export async function assignAssetApi(id: number, input: AssignAssetInput) {
  const response = await api.patch<ApiResponse<AssignAssetResponse>>(
    `/assets/${id}/assign`,
    input,
  );

  return response.data.data;
}

export async function returnAssetApi(id: number, input: ReturnAssetInput) {
  const response = await api.patch<ApiResponse<Asset>>(
    `/assets/${id}/return`,
    input,
  );

  return response.data.data;
}

export async function changeAssetStatusApi(
  id: number,
  input: ChangeAssetStatusInput,
) {
  const response = await api.patch<ApiResponse<Asset>>(
    `/assets/${id}/status`,
    input,
  );

  return response.data.data;
}

export async function getAssetAssignmentHistoryApi(id: number) {
  const response = await api.get<ApiResponse<AssetAssignment[]>>(
    `/assets/${id}/assignment-history`,
  );

  return response.data.data;
}
