"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { useForgotPassword } from "@/features/auth/hooks";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/features/auth/schemas";
import { getApiErrorMessage } from "@/lib/axios";

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [requestAccepted, setRequestAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit: SubmitHandler<ForgotPasswordFormValues> = async (values) => {
    setFormError(null);

    try {
      await forgotPassword.mutateAsync(values);
      setRequestAccepted(true);
      form.reset();
    } catch (error) {
      setFormError(
        getApiErrorMessage(
          error,
          "Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.",
        ),
      );
    }
  };

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-white/80 bg-white/95 shadow-xl shadow-slate-200/80 motion-panel">
        <CardHeader className="space-y-4 border-b">
          <div className="grid size-11 place-items-center rounded-xl bg-teal-950 text-white">
            {requestAccepted ? (
              <ShieldCheck className="size-5" />
            ) : (
              <Mail className="size-5" />
            )}
          </div>
          <div>
            <CardTitle className="text-2xl">
              {requestAccepted ? "Kiểm tra email của bạn" : "Quên mật khẩu"}
            </CardTitle>
            <CardDescription>
              {requestAccepted
                ? "Nếu tài khoản đủ điều kiện, bạn sẽ nhận được liên kết đặt lại mật khẩu."
                : "Nhập email tài khoản nội bộ để yêu cầu liên kết đặt lại mật khẩu."}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {requestAccepted ? (
            <div className="grid gap-4">
              <p
                aria-live="polite"
                className="rounded-lg border border-teal-900/10 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950"
              >
                Vì lý do bảo mật, hệ thống luôn hiển thị thông báo này dù email
                có tồn tại hay không. Liên kết hợp lệ trong 15 phút và chỉ dùng
                được một lần.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">
                  <ArrowLeft className="size-4" />
                  Quay lại đăng nhập
                </Link>
              </Button>
            </div>
          ) : (
            <form
              className="grid gap-4"
              noValidate
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="employee@officeflow.com"
                  aria-invalid={Boolean(form.formState.errors.email)}
                  disabled={forgotPassword.isPending}
                  {...form.register("email")}
                />
                {form.formState.errors.email?.message ? (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.email.message}
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
                disabled={forgotPassword.isPending}
              >
                <Mail className="size-4" />
                {forgotPassword.isPending
                  ? "Đang gửi yêu cầu..."
                  : "Gửi liên kết đặt lại"}
              </Button>

              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Quay lại đăng nhập
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
