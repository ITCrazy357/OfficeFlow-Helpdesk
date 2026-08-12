import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTicketCategoryApi,
  deleteTicketCategoryApi,
  getTicketCategoriesApi,
  updateTicketCategoryApi,
} from "./api";
import type {
  CreateTicketCategoryInput,
  UpdateTicketCategoryInput,
} from "./types";

export const ticketCategoryQueryKeys = {
  all: ["ticket-categories"] as const,
  list: () => [...ticketCategoryQueryKeys.all, "list"] as const,
};

function invalidateCategoryConsumers(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ticketCategoryQueryKeys.all });
  queryClient.invalidateQueries({ queryKey: ["tickets"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useTicketCategories(enabled = true) {
  return useQuery({
    queryKey: ticketCategoryQueryKeys.list(),
    queryFn: getTicketCategoriesApi,
    enabled,
    retry: false,
  });
}

export function useCreateTicketCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketCategoryInput) =>
      createTicketCategoryApi(input),
    onSuccess: () => {
      invalidateCategoryConsumers(queryClient);
    },
  });
}

export function useUpdateTicketCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateTicketCategoryInput;
    }) => updateTicketCategoryApi(id, input),
    onSuccess: () => {
      invalidateCategoryConsumers(queryClient);
    },
  });
}

export function useDeleteTicketCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteTicketCategoryApi(id),
    onSuccess: () => {
      invalidateCategoryConsumers(queryClient);
    },
  });
}
