import { getApiErrorMessage } from "@/lib/axios";
import type { LeaveRequestStatus } from "./types";

export const leaveRequestStatusOptions: Array<{
  value: LeaveRequestStatus;
  label: string;
}> = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Đã từ chối" },
  { value: "CANCELLED", label: "Đã hủy" },
];

export const leaveRequestStatusLabels: Record<LeaveRequestStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
};

function parseDateOnly(value: string) {
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function formatLeaveDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = parseDateOnly(value);

  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatLeaveDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getLeaveDayCount(startDate: string, endDate: string) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end || start > end) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}

export function getLeaveRequestErrorMessage(
  error: unknown,
  fallback = "Không thể xử lý đơn nghỉ phép. Vui lòng thử lại.",
) {
  const message = getApiErrorMessage(error, fallback);
  const translations: Record<string, string> = {
    "Start date must be before or equal to end date":
      "Ngày bắt đầu phải trước hoặc trùng ngày kết thúc.",
    "Start date can not be in the past":
      "Ngày bắt đầu không được nằm trong quá khứ.",
    "Leave request overlaps with an existing request":
      "Khoảng nghỉ này trùng với một đơn đang chờ duyệt hoặc đã được duyệt.",
    "Assigned manager is not available for leave approval":
      "Quản lý được chỉ định hiện không thể duyệt đơn. Vui lòng liên hệ quản trị viên để kiểm tra người quản lý trực tiếp.",
    "Assigned manager cannot approve leave requests":
      "Người quản lý được chỉ định không có quyền duyệt đơn nghỉ phép.",
    "You cannot be the approver of your own leave request":
      "Bạn không thể tự duyệt đơn nghỉ phép của mình.",
    "Leave request could not be created due to a concurrent update":
      "Dữ liệu vừa thay đổi đồng thời. Vui lòng gửi lại đơn.",
    "Leave request not found":
      "Không tìm thấy đơn nghỉ phép hoặc bạn không có quyền truy cập.",
    "Only a pending leave request can be cancelled":
      "Chỉ có thể hủy đơn đang chờ duyệt.",
    "Leave request is no longer pending":
      "Đơn này không còn ở trạng thái chờ duyệt.",
    "Leave request has already been processed":
      "Đơn này đã được xử lý trước đó.",
    Forbidden: "Bạn không có quyền thực hiện thao tác này.",
  };

  return translations[message] ?? message;
}
