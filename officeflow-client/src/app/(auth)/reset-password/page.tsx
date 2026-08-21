"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
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
import { useResetForgottenPassword } from "@/features/auth/hooks";
import {
  resetForgottenPasswordSchema,
  type ResetForgottenPasswordFormValues,
} from "@/features/auth/schemas";
import { getApiErrorMessage } from "@/lib/axios";

const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export default function ResetPasswordPage() {
  const resetPassword = useResetForgottenPassword();
  const [token, setToken] = useState<string | null>();
  const [passwordReset, setPasswordReset] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ResetForgottenPasswordFormValues>({
    resolver: zodResolver(resetForgottenPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const rawToken = fragment.get("token");
    const parsedToken =
      rawToken && RESET_TOKEN_PATTERN.test(rawToken) ? rawToken : null;

    window.history.replaceState(null, "", window.location.pathname);

    const updateToken = window.setTimeout(() => {
      setToken(parsedToken);
    }, 0);

    return () => window.clearTimeout(updateToken);
  }, []);

  const onSubmit: SubmitHandler<ResetForgottenPasswordFormValues> = async (
    values,
  ) => {
    if (!token) {
      return;
    }

    setFormError(null);

    try {
      await resetPassword.mutateAsync({
        token,
        newPassword: values.newPassword,
      });
      setPasswordReset(true);
      setToken(null);
      form.reset();
    } catch (error) {
      setFormError(
        getApiErrorMessage(
          error,
          "Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.",
        ),
      );
    }
  };

  if (token === undefined) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-background px-4">
        <div className="h-44 w-full max-w-md rounded-xl border bg-card motion-shimmer" />
      </main>
    );
  }

  if (passwordReset) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4 border-b">
            <div className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-800">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <CardTitle>Đã đặt lại mật khẩu</CardTitle>
              <CardDescription>
                Tất cả phiên đăng nhập cũ đã bị thu hồi. Hãy đăng nhập lại bằng
                mật khẩu mới.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-teal-950 hover:bg-teal-900">
              <Link href="/login">Đăng nhập</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4 border-b">
            <div className="grid size-11 place-items-center rounded-xl bg-red-50 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <CardTitle>Liên kết không hợp lệ</CardTitle>
              <CardDescription>
                Liên kết đặt lại mật khẩu bị thiếu, không hợp lệ hoặc đã được
                sử dụng.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild className="w-full bg-teal-950 hover:bg-teal-900">
              <Link href="/forgot-password">Yêu cầu liên kết mới</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Quay lại đăng nhập</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 border-b">
          <div className="grid size-11 place-items-center rounded-xl bg-teal-950 text-white">
            <KeyRound className="size-5" />
          </div>
          <div>
            <CardTitle>Đặt mật khẩu mới</CardTitle>
            <CardDescription>
              Liên kết chỉ sử dụng được một lần. Sau khi hoàn tất, toàn bộ phiên
              đăng nhập cũ sẽ bị thu hồi.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-4"
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className="grid gap-2">
              <Label htmlFor="new-password">Mật khẩu mới</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.newPassword)}
                disabled={resetPassword.isPending}
                {...form.register("newPassword")}
              />
              <p className="text-xs text-muted-foreground">
                Sử dụng ít nhất 12 ký tự và không trùng mật khẩu hiện tại.
              </p>
              {form.formState.errors.newPassword?.message ? (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.newPassword.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.confirmPassword)}
                disabled={resetPassword.isPending}
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword?.message ? (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive"
              >
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full bg-teal-950 hover:bg-teal-900"
              disabled={resetPassword.isPending}
            >
              <KeyRound className="size-4" />
              {resetPassword.isPending
                ? "Đang đặt lại mật khẩu..."
                : "Xác nhận mật khẩu mới"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
