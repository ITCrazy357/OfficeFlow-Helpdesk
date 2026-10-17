import type { LeaveCalendarItem, LeaveRequest } from "./types";

export const leaveTypeLabels = {
  ANNUAL: "Phép năm",
  UNPAID: "Không lương",
  SICK: "Nghỉ ốm",
  LEGACY: "Đơn cũ chưa phân loại",
};
export const leavePeriodLabels = {
  FULL_DAY: "Cả ngày",
  MORNING: "Buổi sáng",
  AFTERNOON: "Buổi chiều",
};

export function leaveDuration(
  request: Pick<
    LeaveRequest,
    "days" | "startDate" | "endDate" | "period" | "type"
  >,
) {
  if (request.days?.length)
    return `${request.days.reduce((sum, day) => sum + day.halfDays, 0) / 2} ngày công · ${leavePeriodLabels[request.period ?? "FULL_DAY"]}`;
  return "Đơn cũ: chưa xác định ngày công";
}

export function monthDays(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const start = new Date(`${month}-01T00:00:00Z`);
  if (
    Number.isNaN(start.getTime()) ||
    start.toISOString().slice(0, 7) !== month
  )
    return [];
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const days: string[] = [];
  for (
    let date = start;
    date < end;
    date = new Date(date.getTime() + 86_400_000)
  )
    days.push(date.toISOString().slice(0, 10));
  return days;
}

export function leavesOnDate(items: LeaveCalendarItem[], date: string) {
  return items.filter((item) =>
    item.days?.length
      ? item.days.some((day) => day.date.slice(0, 10) === date)
      : item.startDate.slice(0, 10) <= date &&
        item.endDate.slice(0, 10) >= date,
  );
}

export function overlappingLeaveCount(items: LeaveCalendarItem[]) {
  const morning = new Set<number>();
  const afternoon = new Set<number>();
  for (const item of items) {
    if (item.period !== "AFTERNOON") morning.add(item.requester.id);
    if (item.period !== "MORNING") afternoon.add(item.requester.id);
  }
  return Math.max(morning.size, afternoon.size);
}
