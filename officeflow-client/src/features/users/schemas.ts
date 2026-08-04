import { z } from "zod";

export const userFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên ít nhất 2 ký tự")
    .max(100, "Tên tối đa 100 ký tự"),
  email: z
    .string()
    .trim()
    .email("Email không hợp lệ")
    .max(191, "Email tối đa 191 ký tự"),
  role: z.enum(["ADMIN", "MANAGER", "IT_STAFF", "EMPLOYEE"]),
  departmentId: z.string().min(1, "Vui lòng chọn phòng ban"),
  password: z
    .string()
    .max(128, "Mật khẩu tối đa 128 ký tự")
    .refine(
      (value) => value.length === 0 || value.length >= 12,
      "Mật khẩu ít nhất 12 ký tự",
    ),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Mật khẩu ít nhất 12 ký tự")
      .max(128, "Mật khẩu tối đa 128 ký tự"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
