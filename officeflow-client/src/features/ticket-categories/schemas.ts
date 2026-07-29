import { z } from "zod";

export const ticketCategoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên danh mục phải có ít nhất 2 ký tự")
    .max(100, "Tên danh mục tối đa 100 ký tự"),
});

export type TicketCategoryFormValues = z.infer<
  typeof ticketCategoryFormSchema
>;
