"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChangePassword, useLogout, useMe } from "@/features/auth/hooks";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/features/auth/schemas";
import { getApiErrorMessage } from "@/lib/axios";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-medium text-destructive">{message}</p>
  ) : null;
}

function ChangePasswordLoading() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-4 h-5 w-48 rounded-full bg-muted motion-shimmer" />
        <div className="grid gap-3">
          <div className="h-10 rounded-lg bg-muted motion-shimmer" />
          <div className="h-10 rounded-lg bg-muted motion-shimmer" />
          <div className="h-10 rounded-lg bg-muted motion-shimmer" />
        </div>
      </div>
    </main>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: user, isError, isLoading } = useMe();
  const changePassword = useChangePassword();
  const logout = useLogout();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (isError) {
      void logout().finally(() => router.replace("/login"));
    }
  }, [isError, logout, router]);

  const onSubmit: SubmitHandler<ChangePasswordFormValues> = async (values) => {
    setFormError(null);

    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      router.replace("/login");
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, "Không thể đổi mật khẩu. Vui lòng thử lại."),
      );
    }
  };

  async function handleSecondaryAction() {
    if (!user?.mustChangePassword) {
      router.replace("/dashboard");
      return;
    }

    await logout().catch(() => undefined);
    router.replace("/login");
  }

  if (isLoading || !user) {
    return <ChangePasswordLoading />;
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="border-b">
          <div className="mb-3 grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-800">
            {user.mustChangePassword ? (
              <ShieldCheck className="size-6" />
            ) : (
              <KeyRound className="size-6" />
            )}
          </div>
          <CardTitle>
            {user.mustChangePassword ? "Bạn cần đổi mật khẩu" : "Đổi mật khẩu"}
          </CardTitle>
          <CardDescription>
            {user.mustChangePassword
              ? "Mật khẩu hiện tại là mật khẩu tạm. Bạn chỉ có thể tiếp tục sử dụng OfficeFlow sau khi thiết lập mật khẩu mới."
              : "Sau khi đổi mật khẩu, toàn bộ phiên đăng nhập sẽ bị thu hồi và bạn cần đăng nhập lại."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-5"
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="grid gap-2">
              <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(form.formState.errors.currentPassword)}
                {...form.register("currentPassword")}
              />
              <FieldError
                message={form.formState.errors.currentPassword?.message}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-password">Mật khẩu mới</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.newPassword)}
                {...form.register("newPassword")}
              />
              <p className="text-xs text-muted-foreground">
                Sử dụng ít nhất 12 ký tự và không trùng mật khẩu hiện tại.
              </p>
              <FieldError
                message={form.formState.errors.newPassword?.message}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.confirmPassword)}
                {...form.register("confirmPassword")}
              />
              <FieldError
                message={form.formState.errors.confirmPassword?.message}
              />
            </div>

            {formError ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive"
              >
                {formError}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={changePassword.isPending}
                onClick={() => void handleSecondaryAction()}
              >
                {user.mustChangePassword ? <LogOut className="size-4" /> : null}
                {user.mustChangePassword ? "Đăng xuất" : "Quay lại"}
              </Button>
              <Button type="submit" disabled={changePassword.isPending}>
                <KeyRound className="size-4" />
                {changePassword.isPending
                  ? "Đang đổi mật khẩu..."
                  : "Xác nhận đổi mật khẩu"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
