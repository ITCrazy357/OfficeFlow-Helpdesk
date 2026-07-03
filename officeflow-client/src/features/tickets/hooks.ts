import { useQuery } from "@tanstack/react-query";
import { getTicketsApi } from "./api";
import type { GetTicketsParams } from "./types";

export const ticketsQueryKeys = {
  all: ["tickets"] as const,
  list: (params: GetTicketsParams) => [...ticketsQueryKeys.all, params] as const,
};

export function useTickets(params: GetTicketsParams) {
  return useQuery({
    queryKey: ticketsQueryKeys.list(params),
    queryFn: () => getTicketsApi(params),
  });
}
