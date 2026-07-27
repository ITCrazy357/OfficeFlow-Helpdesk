import type {
  AssetStatus,
  AssetType,
  ManualAssetStatus,
} from "./types";

export const assetTypeOptions: Array<{
  value: AssetType;
  label: string;
}> = [
  { value: "LAPTOP", label: "Máy tính xách tay" },
  { value: "DESKTOP", label: "Máy tính để bàn" },
  { value: "MONITOR", label: "Màn hình" },
  { value: "PRINTER", label: "Máy in" },
  { value: "PHONE", label: "Điện thoại" },
  { value: "TABLET", label: "Máy tính bảng" },
  { value: "NETWORK_DEVICE", label: "Thiết bị mạng" },
  { value: "ACCESSORY", label: "Phụ kiện" },
  { value: "OTHER", label: "Khác" },
];

export const assetStatusOptions: Array<{
  value: AssetStatus;
  label: string;
}> = [
  { value: "AVAILABLE", label: "Sẵn sàng" },
  { value: "ASSIGNED", label: "Đang sử dụng" },
  { value: "MAINTENANCE", label: "Đang bảo trì" },
  { value: "RETIRED", label: "Đã ngừng sử dụng" },
  { value: "LOST", label: "Thất lạc" },
];

export const manualAssetStatusOptions = assetStatusOptions.filter(
  (
    option,
  ): option is {
    value: ManualAssetStatus;
    label: string;
  } => option.value !== "ASSIGNED",
);

export const assetStatusMeta: Record<
  AssetStatus,
  { label: string; className: string }
> = {
  AVAILABLE: {
    label: "Sẵn sàng",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  ASSIGNED: {
    label: "Đang sử dụng",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  MAINTENANCE: {
    label: "Đang bảo trì",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  RETIRED: {
    label: "Đã ngừng sử dụng",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
  LOST: {
    label: "Thất lạc",
    className: "border-red-200 bg-red-50 text-red-800",
  },
};

export function getAssetTypeLabel(type: AssetType) {
  return assetTypeOptions.find((option) => option.value === type)?.label ?? type;
}

export function formatAssetDate(
  value?: string | null,
  includeTime = false,
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

export function getAssetModelLabel(asset: {
  brand?: string | null;
  model?: string | null;
}) {
  return [asset.brand, asset.model].filter(Boolean).join(" ") || "Chưa cập nhật";
}
