"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/shared/components/ui/button";
import { InputField } from "@/shared/components/ui/form-field";
import { useToast } from "@/shared/components/toast/toast-provider";
import { useAuth } from "@/features/auth/context/auth-context";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/schemas/auth-schemas";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const { login } = useAuth();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values);
      toast.success("Đăng nhập thành công");
      router.push("/tickets");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Đăng nhập thất bại";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="motion-enter grid gap-4">
      <InputField
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <InputField
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
        icon={<LogIn className="h-4 w-4" />}
      >
        {isSubmitting ? "Đang đăng nhập" : "Đăng nhập"}
      </Button>
      <p className="rounded-xl bg-zinc-50 px-3 py-3 text-center text-sm text-zinc-600">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-semibold text-teal-700">
          Đăng ký
        </Link>
      </p>
    </form>
  );
}
