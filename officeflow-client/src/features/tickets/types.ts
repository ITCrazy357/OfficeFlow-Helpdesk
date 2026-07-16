import type { PaginatedData } from "@/types/api";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type Ticket = {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: number;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: number;
    name: string;
    email: string;
  } | null;
  category?: {
    id: number;
    name: string;
  } | null;
};

export type GetTicketsParams = {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: number;
};

export type TicketsList = PaginatedData<Ticket>;

export type CreateTicketInput = {
  title: string;
  description: string;
  priority?: TicketPriority;
  categoryId?: number;
};

export type UpdateTicketInput = Partial<CreateTicketInput>;

export type UpdateTicketStatusInput = {
  status: TicketStatus;
};

export type AssignTicketInput = {
  assignedToId: number;
};

export type DeleteTicketResponse = {
  id: number;
};
