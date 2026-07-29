import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type { TicketCategory } from "./types";

export async function getTicketCategoriesApi() {
  const response =
    await api.get<ApiResponse<TicketCategory[]>>("/ticket-categories");

  return response.data.data;
}
