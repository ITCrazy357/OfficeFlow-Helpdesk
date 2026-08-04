"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { resetPasswordSchema, type ResetPasswordFormValues } from "../schemas";

type ResetPasswordFormProps = {
  isSubmitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (values: ResetPasswordFormValues) => Promise<void> | void;
};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs font-medium text-destructive">{message}</p>
  ) : null;
}

export function ResetPasswordForm({
  isSubmitting = false,
  error,
  onCancel,
  onSubmit,
}: ResetPasswordFormProps) {
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const handleSubmit: SubmitHandler<ResetPasswordFormValues> = async (
    values,
  ) => {
    await onSubmit(values);
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
    >
      <div className="grid gap-2">
        <Label htmlFor="reset-user-password">Mật khẩu mới</Label>
        <Input
          id="reset-user-password"
          type="password"
          autoComplete="new-password"
          placeholder="Ít nhất 12 ký tự"
          aria-invalid={Boolean(form.formState.errors.password)}
          disabled={isSubmitting}
          {...form.register("password")}
        />
        <FieldError message={form.formState.errors.password?.message} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirm-user-password">Xác nhận mật khẩu</Label>
        <Input
          id="confirm-user-password"
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu mới"
          aria-invalid={Boolean(form.formState.errors.confirmPassword)}
          disabled={isSubmitting}
          {...form.register("confirmPassword")}
        />
        <FieldError message={form.formState.errors.confirmPassword?.message} />
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Sau khi đặt lại mật khẩu, tất cả phiên đăng nhập hiện tại của tài khoản
        này sẽ bị thu hồi.
      </p>

      {error ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <KeyRound className="size-4" />
          {isSubmitting ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
        </Button>
      </div>
    </form>
  );
}
