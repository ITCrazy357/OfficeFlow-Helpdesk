import { api } from "@/lib/axios";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  CreateTicketInput,
  DeleteTicketResponse,
  AssignTicketInput,
  GetTicketsParams,
  Ticket,
  UpdateTicketInput,
  UpdateTicketStatusInput,
} from "./types";

export async function getTicketsApi(params: GetTicketsParams = {}) {
  const res = await api.get<PaginatedResponse<Ticket>>("/tickets", {
    params,
  });

  return res.data.data;
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
