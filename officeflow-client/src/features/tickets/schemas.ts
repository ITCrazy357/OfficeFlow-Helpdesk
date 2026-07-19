import { z } from "zod";
import type { CreateTicketInput } from "./types";

export const ticketFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Tiêu đề ít nhất 3 ký tự")
    .max(100, "Tiêu đề tối đa 100 ký tự"),
  description: z.string().trim().min(10, "Mô tả ít nhất 10 ký tự"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  categoryId: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || (Number.isInteger(Number(value)) && Number(value) > 0),
      "Danh mục ID phải là số nguyên lớn hơn 0",
    ),
});

export type TicketFormValues = z.infer<typeof ticketFormSchema>;

export function toTicketPayload(values: TicketFormValues): CreateTicketInput {
  const categoryId = values.categoryId ? Number(values.categoryId) : undefined;

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    priority: values.priority,
    categoryId: Number.isInteger(categoryId) ? categoryId : undefined,
  };
}
