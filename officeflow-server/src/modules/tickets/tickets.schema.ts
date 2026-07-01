import { z } from "zod";

export const createTicketSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  categoryId: z.number().int().positive().optional(),
});

export const updateTicketSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().min(10).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  categoryId: z.number().int().positive().optional(),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"]),
});

export const assignTicketSchema = z.object({
  assignedToId: z.number().int().positive(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
