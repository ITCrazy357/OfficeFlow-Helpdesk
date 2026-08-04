import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu")
    .max(128, "Mật khẩu tối đa 128 ký tự"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Tên ít nhất 2 ký tự"),
  email: z.string().trim().email("Email không hợp lệ"),
  password: z
    .string()
    .min(12, "Mật khẩu ít nhất 12 ký tự")
    .max(128, "Mật khẩu tối đa 128 ký tự"),
  departmentId: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || (Number.isInteger(Number(value)) && Number(value) > 0),
      "Department ID phải là số nguyên lớn hơn 0",
    ),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
