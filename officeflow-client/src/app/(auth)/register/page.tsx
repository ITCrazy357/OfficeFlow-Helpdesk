"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { useRegister } from "@/features/auth/hooks";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/features/auth/schemas";
import { getApiErrorMessage } from "@/lib/axios";

export default function RegisterPage() {
  const router = useRouter();
  const registerMutation = useRegister();
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      departmentId: "",
    },
  });

  const onSubmit: SubmitHandler<RegisterFormValues> = async (values) => {
    setFormError(null);
    setSuccessMessage(null);

    try {
      await registerMutation.mutateAsync({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        departmentId: values.departmentId
          ? Number(values.departmentId)
          : undefined,
      });
      setSuccessMessage("Đăng ký thành công. Đang chuyển sang đăng nhập...");
      setTimeout(() => router.replace("/login"), 900);
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, "Đăng ký thất bại. Vui lòng thử lại."),
      );
    }
  };

  const nameError = form.formState.errors.name?.message;
  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;
  const departmentError = form.formState.errors.departmentId?.message;

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-white/80 bg-white/95 shadow-xl shadow-slate-200/80 motion-panel">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-teal-950 text-white shadow-sm shadow-teal-950/20">
              <UserPlus className="size-5" />
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">
                <ArrowLeft className="size-4" />
                Đăng nhập
              </Link>
            </Button>
          </div>
          <div>
            <CardTitle className="text-2xl">Tạo tài khoản</CardTitle>
            <CardDescription>
              Tài khoản mới sẽ được tạo với vai trò nhân viên mặc định.
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
              <Label htmlFor="name">Họ tên</Label>
              <Input
                id="name"
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                aria-invalid={Boolean(nameError)}
                disabled={registerMutation.isPending}
                {...form.register("name")}
              />
              {nameError ? (
                <p className="text-xs font-medium text-destructive">
                  {nameError}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="user@officeflow.com"
                aria-invalid={Boolean(emailError)}
                disabled={registerMutation.isPending}
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
                autoComplete="new-password"
                placeholder="Ít nhất 6 ký tự"
                aria-invalid={Boolean(passwordError)}
                disabled={registerMutation.isPending}
                {...form.register("password")}
              />
              {passwordError ? (
                <p className="text-xs font-medium text-destructive">
                  {passwordError}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="departmentId">Department ID</Label>
              <Input
                id="departmentId"
                type="number"
                min={1}
                placeholder="Tùy chọn, ví dụ: 1"
                aria-invalid={Boolean(departmentError)}
                disabled={registerMutation.isPending}
                {...form.register("departmentId")}
              />
              <p className="text-xs text-muted-foreground">
                API departments yêu cầu đăng nhập, nên register chỉ nhập ID khi
                đã biết phòng ban phù hợp.
              </p>
              {departmentError ? (
                <p className="text-xs font-medium text-destructive">
                  {departmentError}
                </p>
              ) : null}
            </div>

            {formError ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
                {formError}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 motion-toast">
                {successMessage}
              </div>
            ) : null}

            <Button
              type="submit"
              className="h-10 w-full bg-teal-950 hover:bg-teal-900"
              disabled={registerMutation.isPending}
            >
              <UserPlus className="size-4" />
              {registerMutation.isPending ? "Đang tạo..." : "Tạo tài khoản"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
