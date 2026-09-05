import { z } from "zod";
import { getTodayDateInputValue } from "./constants";
import type { CreateLeaveRequestInput } from "./types";

const dateOnlySchema = z.string().trim().pipe(z.iso.date("Ngày không hợp lệ"));

export const leaveRequestFormSchema = z
  .object({
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    reason: z
      .string()
      .trim()
      .min(5, "Lý do cần ít nhất 5 ký tự")
      .max(2000, "Lý do tối đa 2.000 ký tự"),
  })
  .superRefine((values, context) => {
    if (values.startDate < getTodayDateInputValue()) {
      context.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Ngày bắt đầu không được nằm trong quá khứ",
      });
    }

    if (values.endDate < values.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Ngày kết thúc phải từ ngày bắt đầu trở đi",
      });
    }
  });

export type LeaveRequestFormValues = z.infer<typeof leaveRequestFormSchema>;

export function toLeaveRequestPayload(
  values: LeaveRequestFormValues,
): CreateLeaveRequestInput {
  return {
    startDate: values.startDate,
    endDate: values.endDate,
    reason: values.reason.trim(),
  };
}
