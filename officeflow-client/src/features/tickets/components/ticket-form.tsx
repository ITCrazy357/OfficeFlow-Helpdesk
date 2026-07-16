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
        <Label htmlFor="ticket-title">Tieu de</Label>
        <Input
          id="ticket-title"
          placeholder="Vi du: Khong ket noi duoc VPN"
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
        <Label htmlFor="ticket-description">Mo ta</Label>
        <Textarea
          id="ticket-description"
          className="min-h-36 resize-y"
          placeholder="Mo ta van de, thoi diem xay ra va tac dong hien tai"
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
          <Label>Do uu tien</Label>
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
                  <SelectValue placeholder="Chon do uu tien" />
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
          <Label htmlFor="ticket-category-id">Category ID</Label>
          <Input
            id="ticket-category-id"
            type="number"
            min={1}
            placeholder="Tuy chon, vi du: 3"
            aria-invalid={Boolean(form.formState.errors.categoryId)}
            disabled={isSubmitting}
            {...form.register("categoryId")}
          />
          <p className="text-xs text-muted-foreground">
            Backend hien chua co API danh sach category, nen client chi gui
            categoryId neu ban da biet ID.
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
            Huy
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          <Save className="size-4" />
          {isSubmitting ? "Dang luu..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
