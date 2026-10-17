import type { DashboardPerformance, PerformanceDates } from "./types";

export function performanceDates(
  days = 30,
  now = new Date(),
): PerformanceDates {
  const to = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: start.toISOString().slice(0, 10), to };
}

export function validatePerformanceDates(
  dates: PerformanceDates,
  today: string,
) {
  const validDate = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  if (!validDate(dates.from) || !validDate(dates.to))
    return "Chọn đủ hai ngày hợp lệ.";
  if (dates.from > dates.to)
    return "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.";
  if (dates.to > today) return "Ngày kết thúc không được ở tương lai.";
  if ((Date.parse(dates.to) - Date.parse(dates.from)) / 86_400_000 >= 366)
    return "Mỗi báo cáo tối đa 366 ngày.";
  return null;
}

export function formatSlaDuration(minutes: number | null) {
  if (minutes === null) return "—";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(minutes / 60)} giờ`;
}

export function performanceCsv(report: DashboardPerformance) {
  const { cohort, range } = report;
  const rows: Array<Array<string | number | null>> = [
    ["Nhóm", "Chỉ số", "Ngày", "Giá trị", "Số mẫu / mẫu số"],
    ["Phạm vi", "Ticket được tạo từ", range.from, null, null],
    ["Phạm vi", "Ticket được tạo đến", range.to, null, null],
    ["Phạm vi", "Múi giờ", null, range.timezone, null],
    ["Phạm vi", "Thời điểm quan sát", null, report.generatedAt, null],
    [
      "Cách tính",
      "Thời gian theo lịch SLA đã lưu; ticket cũ dùng 24/7",
      null,
      null,
      null,
    ],
    ["Kết quả hiện tại", "Ticket được tạo", null, cohort.total, null],
    [
      "Kết quả hiện tại",
      "Đang ở trạng thái đã xử lý / đã đóng",
      null,
      cohort.completed,
      cohort.total,
    ],
    [
      "Kết quả hiện tại",
      "Phản hồi đầu tiên trung bình (phút SLA)",
      null,
      cohort.firstResponse.minutes,
      cohort.firstResponse.samples,
    ],
    [
      "Kết quả hiện tại",
      "Giải quyết trung bình (phút SLA, lần cuối)",
      null,
      cohort.resolution.minutes,
      cohort.resolution.samples,
    ],
    ["Kết quả hiện tại", "Từng được xử lý", null, cohort.everCompleted, null],
    [
      "Kết quả hiện tại",
      "Từng mở lại (mỗi ticket một lần)",
      null,
      cohort.reopened,
      cohort.everCompleted,
    ],
    [
      "Kết quả hiện tại",
      "Tỷ lệ mở lại (%)",
      null,
      cohort.reopenRate,
      cohort.everCompleted,
    ],
    [
      "Kết quả hiện tại",
      "Ticket cũ dùng lịch 24/7",
      null,
      cohort.legacyCalendarTickets,
      cohort.total,
    ],
    ...report.daily.flatMap((day) => [
      ["Theo ngày tạo", "Được tạo", day.date, day.created, null],
      ["Theo ngày tạo", "Hiện đã xử lý / đóng", day.date, day.completed, null],
    ]),
    ...report.backlog.map((row) => [
      "Tồn đọng hiện tại, mọi ngày tạo (tuổi 24h)",
      row.label,
      null,
      row.total,
      null,
    ]),
  ];
  const cell = (value: string | number | null) => {
    if (value === null) return "";
    const text = String(value);
    const safe =
      typeof value === "string" && /^[\s]*[=+@-]/.test(text)
        ? `'${text}`
        : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n"
  );
}
