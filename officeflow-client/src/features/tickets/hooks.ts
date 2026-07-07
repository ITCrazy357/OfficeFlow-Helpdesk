import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignTicketApi,
  createTicketApi,
  deleteTicketApi,
  getTicketApi,
  getTicketsApi,
  updateTicketApi,
  updateTicketStatusApi,
} from "./api";
import type {
  AssignTicketInput,
  CreateTicketInput,
  GetTicketsParams,
  UpdateTicketInput,
  UpdateTicketStatusInput,
} from "./types";

export const ticketsQueryKeys = {
  all: ["tickets"] as const,
  list: (params: GetTicketsParams) => [...ticketsQueryKeys.all, params] as const,
  detail: (id: number) => [...ticketsQueryKeys.all, "detail", id] as const,
};

export function useTickets(params: GetTicketsParams = {}) {
  return useQuery({
    queryKey: ticketsQueryKeys.list(params),
    queryFn: () => getTicketsApi(params),
  });
}

export function useTicket(id: number, enabled = true) {
  return useQuery({
    queryKey: ticketsQueryKeys.detail(id),
    queryFn: () => getTicketApi(id),
    enabled,
    retry: false,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketInput) => createTicketApi(input),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
      queryClient.setQueryData(ticketsQueryKeys.detail(ticket.id), ticket);
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTicketInput }) =>
      updateTicketApi(id, input),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
      queryClient.setQueryData(ticketsQueryKeys.detail(ticket.id), ticket);
    },
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateTicketStatusInput;
    }) => updateTicketStatusApi(id, input),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
      queryClient.setQueryData(ticketsQueryKeys.detail(ticket.id), ticket);
    },
  });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: AssignTicketInput;
    }) => assignTicketApi(id, input),
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
      queryClient.setQueryData(ticketsQueryKeys.detail(ticket.id), ticket);
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteTicketApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
    },
  });
}
