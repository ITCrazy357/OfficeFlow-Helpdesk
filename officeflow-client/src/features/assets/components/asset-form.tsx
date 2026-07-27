"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Save } from "lucide-react";
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

import { assetTypeOptions } from "../constants";
import {
  assetFormSchema,
  type AssetFormValues,
} from "../schemas";

type AssetFormProps = {
  defaultValues?: Partial<AssetFormValues>;
  submitLabel: string;
  isSubmitting?: boolean;
  error?: string | null;
  onCancel?: () => void;
  onSubmit: (values: AssetFormValues) => Promise<void> | void;
};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs font-medium text-destructive">{message}</p>
  ) : null;
}

export function AssetForm({
  defaultValues,
  submitLabel,
  isSubmitting = false,
  error,
  onCancel,
  onSubmit,
}: AssetFormProps) {
  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      assetTag: defaultValues?.assetTag ?? "",
      name: defaultValues?.name ?? "",
      type: defaultValues?.type ?? "LAPTOP",
      brand: defaultValues?.brand ?? "",
      model: defaultValues?.model ?? "",
      serialNumber: defaultValues?.serialNumber ?? "",
      purchaseDate: defaultValues?.purchaseDate ?? "",
      warrantyUntil: defaultValues?.warrantyUntil ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  const handleSubmit: SubmitHandler<AssetFormValues> = async (values) => {
    await onSubmit(values);
  };

  return (
    <form
      className="grid gap-6"
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="asset-tag">Mã tài sản</Label>
          <Input
            id="asset-tag"
            placeholder="Ví dụ: LAP-0001"
            aria-invalid={Boolean(form.formState.errors.assetTag)}
            disabled={isSubmitting}
            {...form.register("assetTag")}
          />
          <FieldError message={form.formState.errors.assetTag?.message} />
        </div>

        <div className="grid gap-2">
          <Label>Loại tài sản</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn loại tài sản" />
                </SelectTrigger>
                <SelectContent>
                  {assetTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="asset-name">Tên tài sản</Label>
        <Input
          id="asset-name"
          placeholder="Ví dụ: Dell Latitude 5440"
          aria-invalid={Boolean(form.formState.errors.name)}
          disabled={isSubmitting}
          {...form.register("name")}
        />
        <FieldError message={form.formState.errors.name?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="asset-brand">Thương hiệu</Label>
          <Input
            id="asset-brand"
            placeholder="Dell"
            disabled={isSubmitting}
            {...form.register("brand")}
          />
          <FieldError message={form.formState.errors.brand?.message} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-model">Model</Label>
          <Input
            id="asset-model"
            placeholder="Latitude 5440"
            disabled={isSubmitting}
            {...form.register("model")}
          />
          <FieldError message={form.formState.errors.model?.message} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-serial">Số serial</Label>
          <Input
            id="asset-serial"
            placeholder="SN-DELL-00001"
            disabled={isSubmitting}
            {...form.register("serialNumber")}
          />
          <FieldError message={form.formState.errors.serialNumber?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="asset-purchase-date">Ngày mua</Label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="asset-purchase-date"
              type="date"
              className="pl-9"
              disabled={isSubmitting}
              {...form.register("purchaseDate")}
            />
          </div>
          <FieldError message={form.formState.errors.purchaseDate?.message} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-warranty">Bảo hành đến</Label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="asset-warranty"
              type="date"
              className="pl-9"
              disabled={isSubmitting}
              {...form.register("warrantyUntil")}
            />
          </div>
          <FieldError message={form.formState.errors.warrantyUntil?.message} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="asset-notes">Ghi chú</Label>
        <Textarea
          id="asset-notes"
          className="min-h-28 resize-y"
          placeholder="Thông tin mua sắm, vị trí lưu trữ hoặc lưu ý khi sử dụng"
          disabled={isSubmitting}
          {...form.register("notes")}
        />
        <FieldError message={form.formState.errors.notes?.message} />
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
