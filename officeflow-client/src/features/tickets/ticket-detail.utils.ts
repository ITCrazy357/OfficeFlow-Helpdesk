import type { UserListItem } from "@/features/users/types";
import type { TicketHistoryAction } from "./types";

export function formatDateTime(value?: string | null) {
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

export function parseKnowledgeTags(tags?: string | null) {
  return (
    tags
      ?.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  );
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getStaffSupportingText(staff: UserListItem) {
  return [staff.email, staff.department?.name].filter(Boolean).join(" / ");
}

export function matchesStaffSearch(staff: UserListItem, keyword: string) {
  if (!keyword) {
    return true;
  }

  return normalizeSearch(
    [staff.name, staff.email, staff.department?.name].filter(Boolean).join(" "),
  ).includes(keyword);
}

export function getHistoryActionLabel(action: TicketHistoryAction) {
  const labels: Record<TicketHistoryAction, string> = {
    CREATE: "Tạo ticket",
    UPDATE: "Cập nhật ticket",
    STATUS_CHANGED: "Đổi trạng thái",
    ASSIGNED: "Gán người xử lý",
    COMMENTED: "Bình luận",
    ATTACHMENT_ADDED: "Thêm tệp đính kèm",
    ATTACHMENT_DELETED: "Xóa tệp đính kèm",
    DELETED: "Xóa ticket",
  };

  return labels[action] ?? action;
}
