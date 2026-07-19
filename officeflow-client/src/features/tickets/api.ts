import { api } from "@/lib/axios";
import type { ApiResponse, Pagination } from "@/types/api";
import type {
  CreateTicketCommentInput,
  CreateTicketInput,
  DeleteTicketResponse,
  AssignTicketInput,
  GetTicketsParams,
  Ticket,
  TicketComment,
  TicketHistory,
  UpdateTicketInput,
  UpdateTicketStatusInput,
} from "./types";

type BackendTicketsData = {
  data?: Ticket[];
  items?: Ticket[];
  pagination: Pagination;
};

export async function getTicketsApi(params: GetTicketsParams = {}) {
  const res = await api.get<ApiResponse<BackendTicketsData>>("/tickets", {
    params,
  });

  const payload = res.data.data;

  return {
    items: payload.items ?? payload.data ?? [],
    pagination: payload.pagination,
  };
}

export async function getTicketApi(id: number) {
  const res = await api.get<ApiResponse<Ticket>>(`/tickets/${id}`);
  return res.data.data;
}

export async function createTicketApi(input: CreateTicketInput) {
  const res = await api.post<ApiResponse<Ticket>>("/tickets", input);
  return res.data.data;
}

export async function updateTicketApi(id: number, input: UpdateTicketInput) {
  const res = await api.patch<ApiResponse<Ticket>>(`/tickets/${id}`, input);
  return res.data.data;
}

export async function updateTicketStatusApi(
  id: number,
  input: UpdateTicketStatusInput,
) {
  const res = await api.patch<ApiResponse<Ticket>>(
    `/tickets/${id}/status`,
    input,
  );

  return res.data.data;
}

export async function assignTicketApi(id: number, input: AssignTicketInput) {
  const res = await api.patch<ApiResponse<Ticket>>(
    `/tickets/${id}/assign`,
    input,
  );

  return res.data.data;
}

export async function deleteTicketApi(id: number) {
  const res = await api.delete<ApiResponse<DeleteTicketResponse>>(
    `/tickets/${id}`,
  );

  return res.data.data;
}

export async function getTicketCommentsApi(id: number) {
  const res = await api.get<ApiResponse<TicketComment[]>>(
    `/tickets/${id}/comments`,
  );

  return res.data.data;
}

export async function addTicketCommentApi(
  id: number,
  input: CreateTicketCommentInput,
) {
  const res = await api.post<ApiResponse<TicketComment>>(
    `/tickets/${id}/comments`,
    input,
  );

  return res.data.data;
}

export async function getTicketHistoryApi(id: number) {
  const res = await api.get<ApiResponse<TicketHistory[]>>(
    `/tickets/${id}/history`,
  );

  return res.data.data;
}
