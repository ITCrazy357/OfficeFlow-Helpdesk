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
  { value: "LEAVE_REQUEST", label: "Đơn nghỉ phép" },
  { value: "SLA_POLICY", label: "Chính sách SLA" },
];

export const auditLogActionOptions: Array<{
  value: AuditLogAction;
  label: string;
  className: string;
}> = [
  {
    value: "CREATE",
    label: "Tạo mới",
    className: "border-emerald-200 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-200",
  },
  {
    value: "UPDATE",
    label: "Cập nhật",
    className: "border-sky-200 dark:border-sky-400/25 bg-sky-50 dark:bg-sky-400/10 text-sky-800 dark:text-sky-200",
  },
  {
    value: "DELETED",
    label: "Đã xóa",
    className: "border-red-200 dark:border-red-400/25 bg-red-50 dark:bg-red-400/10 text-red-800 dark:text-red-200",
  },
  {
    value: "ASSIGNED",
    label: "Cấp phát",
    className: "border-blue-200 dark:border-blue-400/25 bg-blue-50 dark:bg-blue-400/10 text-blue-800 dark:text-blue-200",
  },
  {
    value: "RETURNED",
    label: "Thu hồi",
    className: "border-cyan-200 bg-cyan-50 text-cyan-800",
  },
  {
    value: "STATUS_CHANGED",
    label: "Đổi trạng thái",
    className: "border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200",
  },
  {
    value: "ACTIVATED",
    label: "Kích hoạt",
    className: "border-emerald-200 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-200",
  },
  {
    value: "DEACTIVATED",
    label: "Vô hiệu hóa",
    className: "border-slate-200 dark:border-slate-400/25 bg-slate-50 dark:bg-slate-400/10 text-slate-700 dark:text-slate-200",
  },
  {
    value: "PUBLISHED",
    label: "Xuất bản",
    className: "border-teal-200 dark:border-teal-400/25 bg-teal-50 dark:bg-teal-400/10 text-teal-800 dark:text-teal-200",
  },
  {
    value: "UNPUBLISHED",
    label: "Gỡ xuất bản",
    className: "border-slate-200 dark:border-slate-400/25 bg-slate-50 dark:bg-slate-400/10 text-slate-700 dark:text-slate-200",
  },
  {
    value: "LINKED",
    label: "Liên kết",
    className: "border-indigo-200 bg-indigo-50 text-indigo-800",
  },
  {
    value: "UNLINKED",
    label: "Gỡ liên kết",
    className: "border-orange-200 dark:border-orange-400/25 bg-orange-50 dark:bg-orange-400/10 text-orange-800 dark:text-orange-200",
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
      className: "border-slate-200 dark:border-slate-400/25 bg-slate-50 dark:bg-slate-400/10 text-slate-700 dark:text-slate-200",
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
