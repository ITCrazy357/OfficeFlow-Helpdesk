import type { UserRole } from "@/features/auth/types";

export const ticketStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
] as const;

export const ticketPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type TicketStatus = (typeof ticketStatuses)[number];
export type TicketPriority = (typeof ticketPriorities)[number];

export type TicketUser = {
  id: number;
  name: string;
  email: string;
  role?: UserRole;
};

export type TicketCategory = {
  id: number;
  name: string;
};

export type Ticket = {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  createdBy: TicketUser;
  assignedTo?: TicketUser | null;
  category?: TicketCategory | null;
};

export type TicketFilters = {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: number;
};

