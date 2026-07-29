import { useQuery } from "@tanstack/react-query";
import { getTicketCategoriesApi } from "./api";

export function useTicketCategories() {
  return useQuery({
    queryKey: ["ticket-categories"],
    queryFn: getTicketCategoriesApi,
    retry: false,
  });
}
