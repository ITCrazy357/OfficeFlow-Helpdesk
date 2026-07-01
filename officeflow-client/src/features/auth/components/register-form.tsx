"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/shared/components/ui/button";
import { InputField } from "@/shared/components/ui/form-field";
import { useToast } from "@/shared/components/toast/toast-provider";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/features/auth/schemas/auth-schemas";
import { authService } from "@/features/auth/services/auth-service";

export function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      departmentId: undefined,
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await authService.register(values);
      toast.success("Đăng ký thành công. Vui lòng đăng nhập để tiếp tục.");
      router.push("/login");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Đăng ký thất bại";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <InputField
        label="Họ tên"
        autoComplete="name"
        error={errors.name?.message}
        {...register("name")}
      />
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
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <InputField
        label="Department ID"
        type="number"
        min={1}
        error={errors.departmentId?.message}
        {...register("departmentId", {
          setValueAs: (value) => (value ? Number(value) : undefined),
        })}
      />
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
        icon={<UserPlus className="h-4 w-4" />}
      >
        {isSubmitting ? "Đang tạo tài khoản" : "Đăng ký"}
      </Button>
      <p className="rounded-xl bg-zinc-50 px-3 py-3 text-center text-sm text-zinc-600">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-semibold text-teal-700">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
