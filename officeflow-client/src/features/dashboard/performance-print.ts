import type { DashboardPerformance } from "./types";
import { formatSlaDuration } from "./performance-utils";

const number = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
const escapeHtml = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

function progressChart(report: DashboardPerformance) {
  const max = Math.max(1, ...report.daily.map((day) => day.created));
  const x = (index: number) =>
    40 + (index * 620) / Math.max(1, report.daily.length - 1);
  const y = (value: number) => 170 - (value / max) * 140;
  const line = (key: "created" | "completed", color: string, dashed = false) =>
    `<polyline points="${report.daily.map((day, index) => `${x(index)},${y(day[key])}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2" ${dashed ? 'stroke-dasharray="6 4"' : ""}/>`;
  return `<svg viewBox="0 0 700 200" role="img" aria-label="Tiến độ theo ngày tạo">
    <path d="M40 25V170H660" fill="none" stroke="#879389"/>
    <text x="30" y="35" text-anchor="end">${max}</text><text x="30" y="174" text-anchor="end">0</text>
    ${line("created", "#235c49")}${line("completed", "#537c91", true)}
    ${report.daily.length === 1 ? `<circle cx="40" cy="${y(report.daily[0].created)}" r="3" fill="#235c49"/><circle cx="40" cy="${y(report.daily[0].completed)}" r="3" fill="#537c91"/>` : ""}
    <text x="40" y="193">${escapeHtml(report.range.from)}</text><text x="660" y="193" text-anchor="end">${escapeHtml(report.range.to)}</text>
  </svg>`;
}

function backlogChart(report: DashboardPerformance) {
  const max = Math.max(1, ...report.backlog.map((row) => row.total));
  return `<svg viewBox="0 0 700 ${Math.max(40, report.backlog.length * 35)}" role="img" aria-label="Tuổi ticket tồn đọng">
    ${report.backlog
      .map(
        (
          row,
          index,
        ) => `<text x="145" y="${index * 35 + 21}" text-anchor="end">${escapeHtml(row.label)}</text>
      <rect x="155" y="${index * 35 + 5}" width="${(row.total / max) * 480}" height="22" rx="3" fill="#9b721f"/>
      <text x="${165 + (row.total / max) * 480}" y="${index * 35 + 21}">${number(row.total)}</text>`,
      )
      .join("")}
  </svg>`;
}

/** A self-contained snapshot: no API calls, application chrome or external assets. */
export function performancePrintHtml(report: DashboardPerformance) {
  const { cohort, range } = report;
  const observedAt = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: range.timezone,
  }).format(new Date(report.generatedAt));
  const metrics = [
    [
      "Đã xử lý / đóng",
      `${number(cohort.completed)} / ${number(cohort.total)}`,
      "Trạng thái hiện tại trong nhóm được chọn.",
    ],
    [
      "Phản hồi đầu tiên TB",
      formatSlaDuration(cohort.firstResponse.minutes),
      `${number(cohort.firstResponse.samples)} / ${number(cohort.total)} ticket có mốc phản hồi hợp lệ.`,
    ],
    [
      "Giải quyết TB",
      formatSlaDuration(cohort.resolution.minutes),
      `${number(cohort.resolution.samples)} / ${number(cohort.completed)} ticket đã xử lý/đóng có mốc hợp lệ; đến lần giải quyết cuối.`,
    ],
    [
      "Tỷ lệ từng mở lại",
      cohort.reopenRate === null ? "—" : `${number(cohort.reopenRate)}%`,
      `${number(cohort.reopened)} / ${number(cohort.everCompleted)} ticket từng được xử lý; mỗi ticket đếm một lần.`,
    ],
  ];
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
    <title>officeflow-hieu-qua-${escapeHtml(range.from)}-${escapeHtml(range.to)}</title>
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #202e29; background: white; font: 10pt/1.5 Arial, sans-serif; }
      main { max-width: 182mm; margin: auto; }
      h1 { margin: 0 0 5mm; font-size: 21pt; line-height: 1.2; }
      h2 { margin: 6mm 0 2mm; font-size: 13pt; }
      p { margin: 2mm 0; } .muted { color: #48584d; font-size: 9pt; }
      .brand { color: #235c49; font-weight: bold; letter-spacing: 1px; }
      .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin: 5mm 0; }
      .metric { border: 1px solid #cbd4cb; border-radius: 5px; padding: 3mm; break-inside: avoid; }
      .value { font-size: 18pt; font-weight: bold; margin: 1mm 0; }
      .chart { break-inside: avoid; } svg { display: block; width: 100%; height: auto; }
      svg text { font: 12px Arial, sans-serif; fill: #202e29; }
      table { width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-variant-numeric: tabular-nums; }
      caption { text-align: left; font-size: 13pt; font-weight: bold; margin: 4mm 0 2mm; }
      th, td { border-bottom: 1px solid #dce2d9; padding: 1.5mm 2mm; text-align: right; }
      th:first-child, td:first-child { text-align: left; }
      thead { display: table-header-group; } tr { break-inside: avoid; }
      @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body><main>
    <p class="brand">OFFICEFLOW HELPDESK</p><h1>Báo cáo hiệu quả xử lý</h1>
    <p><strong>Nhóm ticket tạo từ ${escapeHtml(range.from)} đến ${escapeHtml(range.to)}</strong></p>
    <p class="muted">Quan sát lúc ${escapeHtml(observedAt)} · Múi giờ ${escapeHtml(range.timezone)}.</p>
    <p class="muted">Kết quả hiện tại trong phạm vi quyền của người xuất, gồm cả xử lý/mở lại sau ngày kết thúc bộ lọc. Không phải số lượt xử lý phát sinh trong kỳ.</p>
    <section class="metrics">${metrics.map(([label, value, detail]) => `<div class="metric"><div>${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div><div class="muted">${escapeHtml(detail)}</div></div>`).join("")}</section>
    <p class="muted">Thời gian từ lúc tạo theo lịch SLA đã lưu trên từng ticket; đơn vị giờ SLA. Thiếu mốc hợp lệ hiển thị “—”, không tính là 0. ${number(cohort.legacyCalendarTickets)} ticket cũ chưa lưu lịch dùng 24/7.</p>
    <section class="chart"><h2>Tiến độ theo ngày tạo</h2><p class="muted">Đường liền: được tạo · Đường đứt: hiện đã xử lý / đóng trong cùng nhóm ngày tạo.</p>${cohort.total ? progressChart(report) : "<p>Chưa có ticket trong khoảng đã chọn.</p>"}</section>
    <section class="chart"><h2>Tuổi ticket tồn đọng</h2><p class="muted">Toàn bộ ticket đang mở hoặc đang xử lý trong phạm vi quyền, mọi ngày tạo. Một ngày tuổi = 24 giờ, không theo lịch SLA.</p>${backlogChart(report)}</section>
    <table><caption>Số liệu tồn đọng hiện tại</caption><thead><tr><th scope="col">Tuổi thực tế</th><th scope="col">Ticket</th></tr></thead><tbody>
    ${report.backlog.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${number(row.total)}</td></tr>`).join("")}</tbody></table>
    <table><caption>Tiến độ theo ngày tạo</caption><thead><tr><th scope="col">Ngày tạo</th><th scope="col">Được tạo</th><th scope="col">Hiện đã xử lý / đóng</th></tr></thead><tbody>
    ${report.daily.map((day) => `<tr><th scope="row">${escapeHtml(day.date)}</th><td>${number(day.created)}</td><td>${number(day.completed)}</td></tr>`).join("")}</tbody></table>
    <p class="muted">Số liệu dựa trên mốc thời gian và lịch sử đã lưu; báo cáo có thể dùng bản cache. Lịch sử thiếu không được suy diễn.</p>
    </main></body></html>`;
}

export function printPerformanceReport(report: DashboardPerformance) {
  const frame = document.createElement("iframe");
  frame.title = "Bản PDF báo cáo hiệu quả xử lý";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0";
  const cleanup = () => frame.remove();
  frame.onload = () => {
    const target = frame.contentWindow;
    if (!target) {
      cleanup();
      return;
    }
    target.addEventListener("afterprint", cleanup, { once: true });
    // The built-in print dialog embeds system fonts, preserving Vietnamese text.
    target.focus();
    target.print();
  };
  frame.srcdoc = performancePrintHtml(report);
  document.body.append(frame);
}
