"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FolderKanban, Save } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ticketPriorityOptions } from "../constants";
import { ticketFormSchema, type TicketFormValues } from "../schemas";

type TicketFormProps = {
  defaultValues?: Partial<TicketFormValues>;
  submitLabel: string;
  isSubmitting?: boolean;
  error?: string | null;
  onCancel?: () => void;
  onSubmit: (values: TicketFormValues) => Promise<void> | void;
};

export function TicketForm({
  defaultValues,
  submitLabel,
  isSubmitting = false,
  error,
  onCancel,
  onSubmit,
}: TicketFormProps) {
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      priority: defaultValues?.priority ?? "MEDIUM",
      categoryId: defaultValues?.categoryId ?? "",
    },
  });

  const handleSubmit: SubmitHandler<TicketFormValues> = async (values) => {
    await onSubmit(values);
  };

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
    >
      <div className="grid gap-2">
        <Label htmlFor="ticket-title">Tiêu đề</Label>
        <Input
          id="ticket-title"
          placeholder="Ví dụ: Không kết nối được VPN"
          aria-invalid={Boolean(form.formState.errors.title)}
          disabled={isSubmitting}
          {...form.register("title")}
        />
        {form.formState.errors.title?.message ? (
          <p className="text-xs font-medium text-destructive">
            {form.formState.errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ticket-description">Mô tả</Label>
        <Textarea
          id="ticket-description"
          className="min-h-36 resize-y"
          placeholder="Mô tả vấn đề, thời điểm xảy ra và mức độ ảnh hưởng hiện tại"
          aria-invalid={Boolean(form.formState.errors.description)}
          disabled={isSubmitting}
          {...form.register("description")}
        />
        {form.formState.errors.description?.message ? (
          <p className="text-xs font-medium text-destructive">
            {form.formState.errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Độ ưu tiên</Label>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn độ ưu tiên" />
                </SelectTrigger>
                <SelectContent>
                  {ticketPriorityOptions.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="ticket-category-id">Danh mục ID</Label>
          <div className="relative">
            <FolderKanban className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ticket-category-id"
              type="number"
              min={1}
              className="pl-8"
              placeholder="Tùy chọn, ví dụ: 3"
              aria-invalid={Boolean(form.formState.errors.categoryId)}
              disabled={isSubmitting}
              {...form.register("categoryId")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Backend hiện nhận `categoryId`; chưa có API danh sách category nên
            chỉ nhập khi bạn đã biết ID.
          </p>
          {form.formState.errors.categoryId?.message ? (
            <p className="text-xs font-medium text-destructive">
              {form.formState.errors.categoryId.message}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive motion-toast">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          <Save className="size-4" />
          {isSubmitting ? "Đang lưu..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
