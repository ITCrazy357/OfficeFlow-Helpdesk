"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, FolderKanban, Loader2, Save } from "lucide-react";
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
import { getTicketCategoryLabel } from "@/features/ticket-categories/constants";
import { useTicketCategories } from "@/features/ticket-categories/hooks";
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

  const categoriesQuery = useTicketCategories();
  const categories = categoriesQuery.data ?? [];

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
          <Label htmlFor="ticket-category-id">Danh mục</Label>
          {categoriesQuery.isLoading ? (
            <div className="flex h-10 items-center gap-2 rounded-lg border bg-muted/25 px-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Đang tải danh mục...
            </div>
          ) : categoriesQuery.isError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Không thể tải danh mục.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bạn vẫn có thể tạo ticket mà không chọn danh mục.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => categoriesQuery.refetch()}
                disabled={categoriesQuery.isFetching}
              >
                {categoriesQuery.isFetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Thử lại
              </Button>
            </div>
          ) : categories.length ? (
            <>
              <div className="relative">
                <FolderKanban className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select
                      value={field.value || "NONE"}
                      onValueChange={(value) =>
                        field.onChange(value === "NONE" ? "" : value)
                      }
                      disabled={isSubmitting}
                    >
                      <SelectTrigger
                        id="ticket-category-id"
                        className="w-full pl-9"
                      >
                        <SelectValue placeholder="Chọn danh mục" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">
                          Không chọn danh mục
                        </SelectItem>
                        {categories.map((category) => (
                          <SelectItem
                            key={category.id}
                            value={String(category.id)}
                          >
                            {getTicketCategoryLabel(category.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Chọn danh mục phù hợp để yêu cầu được phân loại chính xác hơn.
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-3">
              <p className="text-sm font-medium">Chưa có danh mục</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Ticket vẫn có thể được tạo mà không cần chọn danh mục.
              </p>
            </div>
          )}
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
