import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type { AiDraft, AiStatus, AiTask } from "./types";

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai", "status"],
    queryFn: async ({ signal }) => {
      const response = await api.get<ApiResponse<AiStatus>>("/ai/status", {
        signal,
      });
      return response.data.data;
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useGenerateAiDraft(ticketId: number) {
  return useMutation({
    mutationFn: async ({
      task,
      signal,
    }: {
      task: AiTask;
      signal: AbortSignal;
    }) => {
      const response = await api.post<ApiResponse<AiDraft>>(
        `/ai/tickets/${ticketId}/draft`,
        { task },
        { signal, timeout: 75_000 },
      );
      return response.data.data;
    },
    retry: false,
    gcTime: 0,
  });
}
