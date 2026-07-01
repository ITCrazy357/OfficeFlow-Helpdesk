import { apiRequest } from "@/shared/api/http-client";
import type { PaginatedData } from "@/shared/types/api";
import type {
  AssignTicketValues,
  TicketFormValues,
  TicketStatusValues,
} from "@/features/tickets/schemas/ticket-schemas";
import type { Ticket, TicketFilters } from "@/features/tickets/types";

export const ticketService = {
  list(filters: TicketFilters = {}) {
    return apiRequest<PaginatedData<Ticket>>(
      "/tickets",
      { method: "GET" },
      filters,
    );
  },

  getById(id: number) {
    return apiRequest<Ticket>(`/tickets/${id}`);
  },

  create(input: TicketFormValues) {
    return apiRequest<Ticket>("/tickets", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: number, input: TicketFormValues) {
    return apiRequest<Ticket>(`/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  updateStatus(id: number, input: TicketStatusValues) {
    return apiRequest<Ticket>(`/tickets/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  assign(id: number, input: AssignTicketValues) {
    return apiRequest<Ticket>(`/tickets/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  delete(id: number) {
    return apiRequest<{ message: string }>(`/tickets/${id}`, {
      method: "DELETE",
    });
  },
};

