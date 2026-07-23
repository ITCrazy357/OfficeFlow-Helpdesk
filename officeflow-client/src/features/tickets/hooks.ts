import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addTicketCommentApi,
  assignTicketApi,
  createTicketApi,
  deleteTicketAttachmentApi,
  deleteTicketApi,
  getTicketAttachmentsApi,
  getTicketCommentsApi,
  getTicketHistoryApi,
  getTicketApi,
  getTicketsApi,
  updateTicketApi,
  updateTicketStatusApi,
  uploadTicketAttachmentApi,
} from "./api";
import type {
  AssignTicketInput,
  CreateTicketCommentInput,
  CreateTicketInput,
  GetTicketsParams,
  TicketAttachment,
  TicketComment,
  UpdateTicketInput,
  UpdateTicketStatusInput,
} from "./types";

export const ticketsQueryKeys = {
  all: ["tickets"] as const,
  list: (params: GetTicketsParams) => [...ticketsQueryKeys.all, params] as const,
  detail: (id: number) => [...ticketsQueryKeys.all, "detail", id] as const,
  comments: (id: number) => [...ticketsQueryKeys.detail(id), "comments"] as const,
  history: (id: number) => [...ticketsQueryKeys.detail(id), "history"] as const,
  attachments: (id: number) =>
    [...ticketsQueryKeys.detail(id), "attachments"] as const,
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

export function useTicketComments(id: number, enabled = true) {
  return useQuery({
    queryKey: ticketsQueryKeys.comments(id),
    queryFn: () => getTicketCommentsApi(id),
    enabled,
    retry: false,
  });
}

export function useTicketHistory(id: number, enabled = true) {
  return useQuery({
    queryKey: ticketsQueryKeys.history(id),
    queryFn: () => getTicketHistoryApi(id),
    enabled,
    retry: false,
  });
}

export function useTicketAttachments(id: number, enabled = true) {
  return useQuery({
    queryKey: ticketsQueryKeys.attachments(id),
    queryFn: () => getTicketAttachmentsApi(id),
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
    onSuccess: (ticket, variables) => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.history(variables.id),
      });
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
    onSuccess: (ticket, variables) => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.history(variables.id),
      });
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
    onSuccess: (ticket, variables) => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.history(variables.id),
      });
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

export function useAddTicketComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: CreateTicketCommentInput;
    }) => addTicketCommentApi(id, input),
    onSuccess: (comment, variables) => {
      queryClient.setQueryData<TicketComment[]>(
        ticketsQueryKeys.comments(variables.id),
        (current) => (current ? [...current, comment] : [comment]),
      );
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.comments(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.history(variables.id),
      });
    },
  });
}

export function useUploadTicketAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      uploadTicketAttachmentApi(id, file),
    onSuccess: (attachment, variables) => {
      queryClient.setQueryData<TicketAttachment[]>(
        ticketsQueryKeys.attachments(variables.id),
        (current) => (current ? [attachment, ...current] : [attachment]),
      );
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.attachments(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.history(variables.id),
      });
    },
  });
}

export function useDeleteTicketAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      attachmentId,
    }: {
      id: number;
      attachmentId: number;
    }) => deleteTicketAttachmentApi(id, attachmentId),
    onSuccess: (deleted, variables) => {
      const deletedId = deleted.id ?? variables.attachmentId;

      queryClient.setQueryData<TicketAttachment[]>(
        ticketsQueryKeys.attachments(variables.id),
        (current) =>
          current?.filter((attachment) => attachment.id !== deletedId) ?? [],
      );
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.attachments(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: ticketsQueryKeys.history(variables.id),
      });
    },
  });
}
