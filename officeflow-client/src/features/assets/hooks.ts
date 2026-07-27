import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignAssetApi,
  changeAssetStatusApi,
  createAssetApi,
  getAssetApi,
  getAssetAssignmentHistoryApi,
  getAssetsApi,
  getMyAssetsApi,
  returnAssetApi,
  updateAssetApi,
} from "./api";
import type {
  AssignAssetInput,
  ChangeAssetStatusInput,
  CreateAssetInput,
  GetAssetsParams,
  ReturnAssetInput,
  UpdateAssetInput,
} from "./types";

export const assetsQueryKeys = {
  all: ["assets"] as const,
  lists: () => [...assetsQueryKeys.all, "list"] as const,
  list: (params: GetAssetsParams) =>
    [...assetsQueryKeys.lists(), params] as const,
  mine: () => [...assetsQueryKeys.all, "mine"] as const,
  detail: (id: number) => [...assetsQueryKeys.all, "detail", id] as const,
  history: (id: number) =>
    [...assetsQueryKeys.detail(id), "assignment-history"] as const,
};

export function useAssets(params: GetAssetsParams = {}, enabled = true) {
  return useQuery({
    queryKey: assetsQueryKeys.list(params),
    queryFn: () => getAssetsApi(params),
    enabled,
    retry: false,
  });
}

export function useMyAssets(enabled = true) {
  return useQuery({
    queryKey: assetsQueryKeys.mine(),
    queryFn: getMyAssetsApi,
    enabled,
    retry: false,
  });
}

export function useAsset(id: number, enabled = true) {
  return useQuery({
    queryKey: assetsQueryKeys.detail(id),
    queryFn: () => getAssetApi(id),
    enabled: enabled && id > 0,
    retry: false,
  });
}

export function useAssetAssignmentHistory(id: number, enabled = true) {
  return useQuery({
    queryKey: assetsQueryKeys.history(id),
    queryFn: () => getAssetAssignmentHistoryApi(id),
    enabled: enabled && id > 0,
    retry: false,
  });
}

function useInvalidateAssetData() {
  const queryClient = useQueryClient();

  return (id?: number) => {
    queryClient.invalidateQueries({ queryKey: assetsQueryKeys.all });
    queryClient.invalidateQueries({ queryKey: ["tickets"] });

    if (id) {
      queryClient.invalidateQueries({ queryKey: assetsQueryKeys.detail(id) });
    }
  };
}

export function useCreateAsset() {
  const invalidateAssetData = useInvalidateAssetData();

  return useMutation({
    mutationFn: (input: CreateAssetInput) => createAssetApi(input),
    onSuccess: (asset) => invalidateAssetData(asset.id),
  });
}

export function useUpdateAsset() {
  const invalidateAssetData = useInvalidateAssetData();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateAssetInput }) =>
      updateAssetApi(id, input),
    onSuccess: (_, variables) => invalidateAssetData(variables.id),
  });
}

export function useAssignAsset() {
  const invalidateAssetData = useInvalidateAssetData();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AssignAssetInput }) =>
      assignAssetApi(id, input),
    onSuccess: (_, variables) => invalidateAssetData(variables.id),
  });
}

export function useReturnAsset() {
  const invalidateAssetData = useInvalidateAssetData();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ReturnAssetInput }) =>
      returnAssetApi(id, input),
    onSuccess: (_, variables) => invalidateAssetData(variables.id),
  });
}

export function useChangeAssetStatus() {
  const invalidateAssetData = useInvalidateAssetData();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: ChangeAssetStatusInput;
    }) => changeAssetStatusApi(id, input),
    onSuccess: (_, variables) => invalidateAssetData(variables.id),
  });
}
