import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ"),
  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu")
    .max(128, "Mật khẩu tối đa 128 ký tự"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Vui lòng nhập mật khẩu hiện tại")
      .max(128, "Mật khẩu tối đa 128 ký tự"),
    newPassword: z
      .string()
      .min(12, "Mật khẩu mới phải có ít nhất 12 ký tự")
      .max(128, "Mật khẩu tối đa 128 ký tự"),
    confirmPassword: z
      .string()
      .min(1, "Vui lòng xác nhận mật khẩu mới")
      .max(128, "Mật khẩu tối đa 128 ký tự"),
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: "Mật khẩu mới không được trùng mật khẩu hiện tại",
    path: ["newPassword"],
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email không hợp lệ")
    .max(254, "Email tối đa 254 ký tự"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetForgottenPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(12, "Mật khẩu mới phải có ít nhất 12 ký tự")
      .max(128, "Mật khẩu tối đa 128 ký tự"),
    confirmPassword: z
      .string()
      .min(1, "Vui lòng xác nhận mật khẩu mới")
      .max(128, "Mật khẩu tối đa 128 ký tự"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

export type ResetForgottenPasswordFormValues = z.infer<
  typeof resetForgottenPasswordSchema
>;
