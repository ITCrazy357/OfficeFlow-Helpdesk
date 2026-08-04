"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save, UserPlus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department } from "@/features/departments/types";

import { userRoleOptions } from "../constants";
import { userFormSchema, type UserFormValues } from "../schemas";

type UserFormProps = {
  mode: "create" | "edit";
  departments: Department[];
  defaultValues?: Partial<UserFormValues>;
  isSubmitting?: boolean;
  isLoadingDepartments?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (values: UserFormValues) => Promise<void> | void;
};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs font-medium text-destructive">{message}</p>
  ) : null;
}

export function UserForm({
  mode,
  departments,
  defaultValues,
  isSubmitting = false,
  isLoadingDepartments = false,
  error,
  onCancel,
  onSubmit,
}: UserFormProps) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      role: defaultValues?.role ?? "EMPLOYEE",
      departmentId: defaultValues?.departmentId ?? "",
      password: "",
    },
  });

  const handleSubmit: SubmitHandler<UserFormValues> = async (values) => {
    if (mode === "create" && !values.password) {
      form.setError("password", {
        message: "Vui lòng nhập mật khẩu ban đầu",
      });
      return;
    }

    await onSubmit(values);
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
    >
      <div className="grid gap-2">
        <Label htmlFor={`${mode}-user-name`}>Họ tên</Label>
        <Input
          id={`${mode}-user-name`}
          autoComplete="off"
          placeholder="Nguyễn Văn A"
          aria-invalid={Boolean(form.formState.errors.name)}
          disabled={isSubmitting}
          {...form.register("name")}
        />
        <FieldError message={form.formState.errors.name?.message} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${mode}-user-email`}>Email</Label>
        <Input
          id={`${mode}-user-email`}
          type="email"
          autoComplete="off"
          placeholder="user@officeflow.com"
          aria-invalid={Boolean(form.formState.errors.email)}
          disabled={isSubmitting}
          {...form.register("email")}
        />
        <FieldError message={form.formState.errors.email?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div className="grid gap-2">
          <Label>Vai trò</Label>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  className="w-full"
                  aria-invalid={Boolean(form.formState.errors.role)}
                >
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {userRoleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={form.formState.errors.role?.message} />
        </div>

        <div className="grid gap-2">
          <Label>Phòng ban</Label>
          <Controller
            control={form.control}
            name="departmentId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSubmitting || isLoadingDepartments}
              >
                <SelectTrigger
                  className="w-full"
                  aria-invalid={Boolean(form.formState.errors.departmentId)}
                >
                  <SelectValue
                    placeholder={
                      isLoadingDepartments
                        ? "Đang tải phòng ban..."
                        : "Chọn phòng ban"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem
                      key={department.id}
                      value={String(department.id)}
                    >
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={form.formState.errors.departmentId?.message} />
        </div>
      </div>

      {mode === "create" ? (
        <div className="grid gap-2">
          <Label htmlFor="create-user-password">Mật khẩu ban đầu</Label>
          <Input
            id="create-user-password"
            type="password"
            autoComplete="new-password"
            placeholder="Ít nhất 12 ký tự"
            aria-invalid={Boolean(form.formState.errors.password)}
            disabled={isSubmitting}
            {...form.register("password")}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </div>
      ) : null}

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
        <Button type="submit" disabled={isSubmitting || isLoadingDepartments}>
          {mode === "create" ? (
            <UserPlus className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          {isSubmitting
            ? "Đang lưu..."
            : mode === "create"
              ? "Tạo tài khoản"
              : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
