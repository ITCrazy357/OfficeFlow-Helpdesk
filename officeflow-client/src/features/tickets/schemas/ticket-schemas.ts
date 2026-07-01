import { z } from "zod";
import { ticketPriorities, ticketStatuses } from "@/features/tickets/types";

export const ticketFormSchema = z.object({
  title: z
    .string()
    .min(3, "Tieu de toi thieu 3 ky tu")
    .max(100, "Tieu de toi da 100 ky tu"),
  description: z.string().min(10, "Mo ta toi thieu 10 ky tu"),
  priority: z.enum(ticketPriorities).optional(),
  categoryId: z.number().int().positive().optional(),
});

export const ticketStatusSchema = z.object({
  status: z.enum(ticketStatuses),
});

export const assignTicketSchema = z.object({
  assignedToId: z.number().int().positive("Nguoi xu ly khong hop le"),
});

export type TicketFormValues = z.infer<typeof ticketFormSchema>;
export type TicketStatusValues = z.infer<typeof ticketStatusSchema>;
export type AssignTicketValues = z.infer<typeof assignTicketSchema>;
