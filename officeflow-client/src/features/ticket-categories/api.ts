import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type {
  CreateTicketCategoryInput,
  DeleteTicketCategoryResponse,
  TicketCategory,
  UpdateTicketCategoryInput,
} from "./types";

export async function getTicketCategoriesApi() {
  const response =
    await api.get<ApiResponse<TicketCategory[]>>("/ticket-categories");

  return response.data.data;
}

export async function getTicketCategoryApi(id: number) {
  const response = await api.get<ApiResponse<TicketCategory>>(
    `/ticket-categories/${id}`,
  );

  return response.data.data;
}

export async function createTicketCategoryApi(
  input: CreateTicketCategoryInput,
) {
  const response = await api.post<ApiResponse<TicketCategory>>(
    "/ticket-categories",
    input,
  );

  return response.data.data;
}

export async function updateTicketCategoryApi(
  id: number,
  input: UpdateTicketCategoryInput,
) {
  const response = await api.patch<ApiResponse<TicketCategory>>(
    `/ticket-categories/${id}`,
    input,
  );

  return response.data.data;
}

export async function deleteTicketCategoryApi(id: number) {
  const response = await api.delete<
    ApiResponse<DeleteTicketCategoryResponse>
  >(`/ticket-categories/${id}`);

  return response.data.data;
}
