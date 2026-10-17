import type { MaintenanceKind, MaintenanceStatus } from "./types";

export const maintenanceKinds: Record<MaintenanceKind, string> = {
  MAINTENANCE: "Bảo trì",
  REPAIR: "Sửa chữa",
  WARRANTY: "Bảo hành",
};
export const maintenanceStatuses: Record<MaintenanceStatus, string> = {
  PLANNED: "Đã lên lịch",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};
export function careToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function maintenanceCost(value: string | null) {
  return value === null
    ? "Chưa ghi nhận"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(Number(value));
}

export function careWarrantyDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? careToday(date) : "";
}
