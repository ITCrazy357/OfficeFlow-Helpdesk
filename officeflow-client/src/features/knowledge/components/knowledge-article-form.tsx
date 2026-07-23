"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, Save, Tags } from "lucide-react";
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
import {
  knowledgeArticleFormSchema,
  type KnowledgeArticleFormValues,
} from "../schemas";

type KnowledgeArticleFormProps = {
  defaultValues?: Partial<KnowledgeArticleFormValues>;
  submitLabel: string;
  isSubmitting?: boolean;
  error?: string | null;
  onCancel?: () => void;
  onSubmit: (values: KnowledgeArticleFormValues) => Promise<void> | void;
};

export function KnowledgeArticleForm({
  defaultValues,
  submitLabel,
  isSubmitting = false,
  error,
  onCancel,
  onSubmit,
}: KnowledgeArticleFormProps) {
  const form = useForm<KnowledgeArticleFormValues>({
    resolver: zodResolver(knowledgeArticleFormSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      summary: defaultValues?.summary ?? "",
      content: defaultValues?.content ?? "",
      tags: defaultValues?.tags ?? "",
      isPublished: defaultValues?.isPublished ?? false,
    },
  });

  const handleSubmit: SubmitHandler<KnowledgeArticleFormValues> = async (
    values,
  ) => {
    await onSubmit(values);
  };

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
    >
      <div className="grid gap-2">
        <Label htmlFor="knowledge-title">Tiêu đề</Label>
        <div className="relative">
          <BookOpen className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="knowledge-title"
            className="pl-8"
            placeholder="Ví dụ: Cách đặt lại mật khẩu VPN"
            aria-invalid={Boolean(form.formState.errors.title)}
            disabled={isSubmitting}
            {...form.register("title")}
          />
        </div>
        {form.formState.errors.title?.message ? (
          <p className="text-xs font-medium text-destructive">
            {form.formState.errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="knowledge-summary">Tóm tắt</Label>
        <Textarea
          id="knowledge-summary"
          className="min-h-20 resize-y"
          placeholder="Một đoạn ngắn giúp người dùng biết bài này giải quyết vấn đề gì"
          aria-invalid={Boolean(form.formState.errors.summary)}
          disabled={isSubmitting}
          {...form.register("summary")}
        />
        {form.formState.errors.summary?.message ? (
          <p className="text-xs font-medium text-destructive">
            {form.formState.errors.summary.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="knowledge-content">Nội dung</Label>
        <Textarea
          id="knowledge-content"
          className="min-h-52 resize-y leading-6"
          placeholder="Viết từng bước xử lý, lưu ý, điều kiện áp dụng và cách kiểm tra kết quả"
          aria-invalid={Boolean(form.formState.errors.content)}
          disabled={isSubmitting}
          {...form.register("content")}
        />
        {form.formState.errors.content?.message ? (
          <p className="text-xs font-medium text-destructive">
            {form.formState.errors.content.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div className="grid gap-2">
          <Label htmlFor="knowledge-tags">Tags</Label>
          <div className="relative">
            <Tags className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="knowledge-tags"
              className="pl-8"
              placeholder="vpn,network,remote"
              aria-invalid={Boolean(form.formState.errors.tags)}
              disabled={isSubmitting}
              {...form.register("tags")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Phân tách tag bằng dấu phẩy.
          </p>
        </div>

        <div className="grid gap-2">
          <Label>Trạng thái</Label>
          <Controller
            control={form.control}
            name="isPublished"
            render={({ field }) => (
              <Select
                value={field.value ? "true" : "false"}
                onValueChange={(value) => field.onChange(value === "true")}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Bản nháp</SelectItem>
                  <SelectItem value="true">Đã xuất bản</SelectItem>
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
