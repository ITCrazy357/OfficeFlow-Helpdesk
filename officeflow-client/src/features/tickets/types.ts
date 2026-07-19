import type { PaginatedData } from "@/types/api";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TicketHistoryAction =
  | "CREATE"
  | "UPDATE"
  | "STATUS_CHANGED"
  | "ASSIGNED"
  | "COMMENTED"
  | "DELETED";

export type TicketUser = {
  id: number;
  name: string;
  email: string;
  role?: string;
};

export type Ticket = {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  createdBy?: TicketUser;
  assignedTo?: TicketUser | null;
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

export type CreateTicketCommentInput = {
  content: string;
};

export type TicketComment = {
  id: number;
  content: string;
  createdAt: string;
  author: TicketUser;
};

export type TicketHistory = {
  id: number;
  action: TicketHistoryAction;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
  user: TicketUser;
};

export type DeleteTicketResponse = {
  id?: number;
  message?: string;
};
