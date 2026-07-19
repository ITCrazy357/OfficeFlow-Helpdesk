"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, LockKeyhole, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

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
import { useLogin } from "@/features/auth/hooks";
import { loginSchema, type LoginFormValues } from "@/features/auth/schemas";
import { getApiErrorMessage } from "@/lib/axios";
import { getAccessToken } from "@/lib/token";

const productNotes = [
  "Theo dõi ticket theo trạng thái và độ ưu tiên",
  "Phân quyền theo ADMIN, IT_STAFF và EMPLOYEE",
  "Dữ liệu đồng bộ trực tiếp với OfficeFlow API",
];

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLogin();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (getAccessToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const onSubmit: SubmitHandler<LoginFormValues> = async (values) => {
    setFormError(null);

    try {
      await loginMutation.mutateAsync(values);
      router.replace("/dashboard");
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, "Đăng nhập thất bại. Vui lòng thử lại."),
      );
    }
  };

  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <main className="relative grid min-h-[100dvh] overflow-hidden bg-background px-4 py-8 text-foreground sm:px-6 lg:grid-cols-[1fr_520px] lg:px-8">
      <section className="relative hidden min-h-full items-center lg:flex">
        <div className="max-w-2xl motion-enter">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-900/10 bg-white/80 px-3 py-1 text-sm font-medium text-teal-950 shadow-sm">
            <LockKeyhole className="size-4" />
            OfficeFlow Helpdesk
          </div>
          <h1 className="max-w-xl text-5xl font-semibold leading-tight tracking-normal">
            Quản lý yêu cầu hỗ trợ nội bộ gọn gàng hơn.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
            Giao diện client kết nối đúng hệ thống hiện có, hỗ trợ tạo ticket,
            theo dõi tiến độ và xử lý theo vai trò đăng nhập.
          </p>

          <div className="mt-10 grid max-w-xl gap-3">
            {productNotes.map((note, index) => (
              <div
                key={note}
                className="motion-card flex items-center gap-3 rounded-xl border border-white/70 bg-white/75 p-4 shadow-sm shadow-slate-200/70"
                style={{ "--motion-index": index } as CSSProperties}
              >
                <div className="grid size-9 place-items-center rounded-lg bg-teal-950 text-white">
                  <CheckCircle2 className="size-4" />
                </div>
                <p className="text-sm font-medium text-slate-700">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center">
        <Card className="w-full max-w-md border-white/80 bg-white/95 shadow-xl shadow-slate-200/80 motion-panel">
          <CardHeader className="space-y-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-teal-950 text-white shadow-sm shadow-teal-950/20">
              <LogIn className="size-5" />
            </div>
            <div>
              <CardTitle className="text-2xl">Đăng nhập</CardTitle>
              <CardDescription>
                Truy cập OfficeFlow Helpdesk bằng tài khoản nội bộ.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
            >
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@officeflow.com"
                  aria-invalid={Boolean(emailError)}
                  disabled={loginMutation.isPending}
                  {...form.register("email")}
                />
                {emailError ? (
                  <p className="text-xs font-medium text-destructive">
                    {emailError}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  aria-invalid={Boolean(passwordError)}
                  disabled={loginMutation.isPending}
                  {...form.register("password")}
                />
                {passwordError ? (
                  <p className="text-xs font-medium text-destructive">
                    {passwordError}
                  </p>
                ) : null}
              </div>

              {formError ? (
                <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
                  {formError}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-10 w-full bg-teal-950 hover:bg-teal-900"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
                <ArrowRight className="size-4" />
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Chưa có tài khoản?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-teal-900 hover:text-teal-700"
                >
                  Đăng ký
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
