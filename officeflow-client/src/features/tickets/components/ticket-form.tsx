"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
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
import { mockTicketCategories, ticketPriorityOptions } from "../constants";
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
      categoryId: defaultValues?.categoryId ?? "none",
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
          placeholder="Mô tả vấn đề, thời điểm xảy ra và tác động hiện tại"
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
          <Label>Danh mục</Label>
          <Controller
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <Select
                value={field.value ?? "none"}
                onValueChange={field.onChange}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không chọn</SelectItem>
                  {mockTicketCategories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={String(category.id)}
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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
