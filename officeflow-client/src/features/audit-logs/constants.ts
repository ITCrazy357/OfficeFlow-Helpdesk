import type { AuditLogAction, AuditLogEntity } from "./types";

export const auditLogEntityOptions: Array<{
  value: AuditLogEntity;
  label: string;
}> = [
  { value: "USER", label: "Người dùng" },
  { value: "DEPARTMENT", label: "Phòng ban" },
  { value: "TICKET", label: "Ticket" },
  { value: "KNOWLEDGE_ARTICLE", label: "Bài viết Knowledge" },
  { value: "ASSET", label: "Tài sản" },
];

export const auditLogActionOptions: Array<{
  value: AuditLogAction;
  label: string;
  className: string;
}> = [
  {
    value: "CREATE",
    label: "Tạo mới",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    value: "UPDATE",
    label: "Cập nhật",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    value: "DELETED",
    label: "Đã xóa",
    className: "border-red-200 bg-red-50 text-red-800",
  },
  {
    value: "ASSIGNED",
    label: "Cấp phát",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  {
    value: "RETURNED",
    label: "Thu hồi",
    className: "border-cyan-200 bg-cyan-50 text-cyan-800",
  },
  {
    value: "STATUS_CHANGED",
    label: "Đổi trạng thái",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    value: "ACTIVATED",
    label: "Kích hoạt",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    value: "DEACTIVATED",
    label: "Vô hiệu hóa",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    value: "PUBLISHED",
    label: "Xuất bản",
    className: "border-teal-200 bg-teal-50 text-teal-800",
  },
  {
    value: "UNPUBLISHED",
    label: "Gỡ xuất bản",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    value: "LINKED",
    label: "Liên kết",
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
  },
  {
    value: "UNLINKED",
    label: "Gỡ liên kết",
    className: "border-orange-200 bg-orange-50 text-orange-800",
  },
];

export function getAuditLogEntityLabel(entity: AuditLogEntity) {
  return (
    auditLogEntityOptions.find((option) => option.value === entity)?.label ??
    entity
  );
}

export function getAuditLogActionMeta(action: AuditLogAction) {
  return (
    auditLogActionOptions.find((option) => option.value === action) ?? {
      value: action,
      label: action,
      className: "border-slate-200 bg-slate-50 text-slate-700",
    }
  );
}

export function formatAuditLogDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}
