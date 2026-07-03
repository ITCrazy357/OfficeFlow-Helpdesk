import { api } from "@/lib/axios";
import type { PaginatedResponse } from "@/types/api";
import type { GetTicketsParams, Ticket } from "./types";

export async function getTicketsApi(params: GetTicketsParams) {
  const res = await api.get<PaginatedResponse<Ticket>>("/tickets", {
    params,
  });

  return res.data.data;
}
