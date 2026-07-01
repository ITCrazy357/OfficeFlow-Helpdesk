"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/shared/components/ui/button";
import {
  InputField,
  SelectField,
  TextareaField,
} from "@/shared/components/ui/form-field";
import {
  ticketFormSchema,
  type TicketFormValues,
} from "@/features/tickets/schemas/ticket-schemas";
import { ticketPriorities } from "@/features/tickets/types";

type TicketFormProps = {
  defaultValues?: Partial<TicketFormValues>;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (values: TicketFormValues) => Promise<void>;
};

export function TicketForm({
  defaultValues,
  isSubmitting,
  onSubmit,
  submitLabel,
}: TicketFormProps) {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      priority: defaultValues?.priority ?? "MEDIUM",
      categoryId: defaultValues?.categoryId,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="motion-enter grid gap-4">
      <InputField
        label="Tiêu đề"
        error={errors.title?.message}
        {...register("title")}
      />
      <TextareaField
        label="Mô tả"
        error={errors.description?.message}
        {...register("description")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Mức độ ưu tiên"
          error={errors.priority?.message}
          {...register("priority")}
        >
          {ticketPriorities.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Category ID"
          type="number"
          min={1}
          error={errors.categoryId?.message}
          {...register("categoryId", {
            setValueAs: (value) => (value ? Number(value) : undefined),
          })}
        />
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 w-full sm:w-fit"
        icon={<Save className="h-4 w-4" />}
      >
        {isSubmitting ? "Đang lưu" : submitLabel}
      </Button>
    </form>
  );
}
