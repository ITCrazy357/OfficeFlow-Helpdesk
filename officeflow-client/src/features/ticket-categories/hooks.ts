import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTicketCategoryApi,
  deleteTicketCategoryApi,
  getTicketCategoriesApi,
  getTicketCategoryApi,
  updateTicketCategoryApi,
} from "./api";
import type {
  CreateTicketCategoryInput,
  UpdateTicketCategoryInput,
} from "./types";

export const ticketCategoryQueryKeys = {
  all: ["ticket-categories"] as const,
  list: () => [...ticketCategoryQueryKeys.all, "list"] as const,
  detail: (id: number) =>
    [...ticketCategoryQueryKeys.all, "detail", id] as const,
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

export function useTicketCategory(id: number, enabled = true) {
  return useQuery({
    queryKey: ticketCategoryQueryKeys.detail(id),
    queryFn: () => getTicketCategoryApi(id),
    enabled,
    retry: false,
  });
}

export function useCreateTicketCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketCategoryInput) =>
      createTicketCategoryApi(input),
    onSuccess: (category) => {
      invalidateCategoryConsumers(queryClient);
      queryClient.setQueryData(
        ticketCategoryQueryKeys.detail(category.id),
        category,
      );
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
    onSuccess: (category) => {
      invalidateCategoryConsumers(queryClient);
      queryClient.setQueryData(
        ticketCategoryQueryKeys.detail(category.id),
        category,
      );
    },
  });
}

export function useDeleteTicketCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteTicketCategoryApi(id),
    onSuccess: (deleted) => {
      invalidateCategoryConsumers(queryClient);
      queryClient.removeQueries({
        queryKey: ticketCategoryQueryKeys.detail(deleted.id),
      });
    },
  });
}
