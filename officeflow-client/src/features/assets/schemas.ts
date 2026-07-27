import { z } from "zod";

import type { CreateAssetInput } from "./types";

const optionalText = (maxLength: number, message: string) =>
  z.string().trim().max(maxLength, message).optional();

const optionalDate = z
  .string()
  .optional()
  .refine(
    (value) => !value || !Number.isNaN(new Date(value).getTime()),
    "Ngày không hợp lệ",
  );

export const assetFormSchema = z.object({
  assetTag: z
    .string()
    .trim()
    .min(2, "Mã tài sản phải có ít nhất 2 ký tự")
    .max(50, "Mã tài sản tối đa 50 ký tự")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Mã tài sản chỉ gồm chữ, số, dấu gạch ngang và gạch dưới",
    ),
  name: z
    .string()
    .trim()
    .min(2, "Tên tài sản phải có ít nhất 2 ký tự")
    .max(150, "Tên tài sản tối đa 150 ký tự"),
  type: z.enum([
    "LAPTOP",
    "DESKTOP",
    "MONITOR",
    "PRINTER",
    "PHONE",
    "TABLET",
    "NETWORK_DEVICE",
    "ACCESSORY",
    "OTHER",
  ]),
  brand: optionalText(100, "Thương hiệu tối đa 100 ký tự"),
  model: optionalText(100, "Model tối đa 100 ký tự"),
  serialNumber: optionalText(100, "Số serial tối đa 100 ký tự"),
  purchaseDate: optionalDate,
  warrantyUntil: optionalDate,
  notes: optionalText(1000, "Ghi chú tối đa 1.000 ký tự"),
});

export type AssetFormValues = z.infer<typeof assetFormSchema>;

function optionalValue(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function toAssetPayload(values: AssetFormValues): CreateAssetInput {
  return {
    assetTag: values.assetTag.trim(),
    name: values.name.trim(),
    type: values.type,
    brand: optionalValue(values.brand),
    model: optionalValue(values.model),
    serialNumber: optionalValue(values.serialNumber),
    purchaseDate: optionalValue(values.purchaseDate),
    warrantyUntil: optionalValue(values.warrantyUntil),
    notes: optionalValue(values.notes),
  };
}
