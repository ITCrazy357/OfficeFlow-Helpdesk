import assert from "node:assert/strict";
import { test } from "node:test";
import { createSourceLoader, rejectStatus } from "./helpers/source-loader.mjs";

test("performance dates use Vietnam midnight, validate real dates and allow 366 inclusive days", () => {
  const utils = createSourceLoader()("features/dashboard/performance-utils.ts");
  assert.deepEqual(
    utils.performanceDates(30, new Date("2026-10-18T17:00:00Z")),
    { from: "2026-09-20", to: "2026-10-19" },
  );
  assert.equal(
    utils.validatePerformanceDates(
      { from: "2025-10-20", to: "2026-10-20" },
      "2026-10-20",
    ),
    null,
  );
  for (const dates of [
    { from: "2025-10-19", to: "2026-10-20" },
    { from: "2026-02-30", to: "2026-10-20" },
    { from: "2026-10-21", to: "2026-10-20" },
    { from: "2026-10-20", to: "2026-10-21" },
    { from: "", to: "2026-10-20" },
  ])
    assert.equal(
      typeof utils.validatePerformanceDates(dates, "2026-10-20"),
      "string",
    );
});

test("performance CSV keeps missing values blank, real zeroes numeric, and escapes spreadsheet formulas", () => {
  const { performanceCsv, formatSlaDuration } = createSourceLoader()(
    "features/dashboard/performance-utils.ts",
  );
  const csv = performanceCsv({
    range: {
      from: "2026-10-01",
      to: "2026-10-18",
      timezone: "Asia/Ho_Chi_Minh",
    },
    generatedAt: "2026-10-18T00:00:00Z",
    cohort: {
      total: 1,
      completed: 1,
      everCompleted: 1,
      reopened: 0,
      reopenRate: 0,
      legacyCalendarTickets: 0,
      firstResponse: { minutes: null, samples: 0 },
      resolution: { minutes: 0, samples: 1 },
    },
    daily: [{ date: "2026-10-01", created: 1, completed: 1 }],
    backlog: [{ key: "test", label: '=SUM(1,2)"\r\n', total: 1 }],
  });
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /Phản hồi đầu tiên trung bình \(phút SLA\)",,,"0"/);
  assert.match(csv, /Giải quyết trung bình \(phút SLA, lần cuối\)",,"0","1"/);
  assert.ok(csv.includes('"\'=SUM(1,2)""\r\n"'));
  assert.equal(formatSlaDuration(null), "—");
  assert.equal(formatSlaDuration(0), "0 giờ");
  assert.equal(formatSlaDuration(120), "2 giờ");
});

test("performance queries cancel requests, preserve temporary failures and replace cached data after access loss", async () => {
  const dates = { from: "2026-01-01", to: "2026-01-31" };
  const signal = new AbortController().signal;
  let failure = null;
  const report = { cohort: { total: 3 } };
  const cleared = [];
  const load = createSourceLoader({
    "@tanstack/react-query": { useQuery: (options) => options, useQueryClient: () => ({ setQueriesData: (...args) => cleared.push(args) }) },
    "./api": { getDashboardPerformanceApi: async (actualDates, actualSignal) => {
      assert.deepEqual(actualDates, dates);
      assert.equal(actualSignal, signal);
      if (failure) throw failure;
      return report;
    } },
  });
  const options = load("features/dashboard/hooks.ts").useDashboardPerformance(dates);
  assert.deepEqual(options.queryKey, ["dashboard", "performance", dates]);
  assert.deepEqual(await options.queryFn({ signal }), { report, accessError: null });
  failure = rejectStatus({}, 503);
  await assert.rejects(options.queryFn({ signal }), (error) => error === failure);
  for (const status of [401, 403]) {
    failure = rejectStatus({}, status);
    assert.deepEqual(await options.queryFn({ signal }), { report: null, accessError: failure });
    assert.deepEqual(cleared.at(-1), [{ queryKey: ["dashboard", "performance"] }, { report: null, accessError: failure }]);
  }
});

test("PDF print snapshot preserves missing samples and escapes every report label", () => {
  const { performancePrintHtml } = createSourceLoader()("features/dashboard/performance-print.ts");
  const html = performancePrintHtml({
    range: { from: "2026-01-01", to: "2026-01-07", timezone: "Asia/Ho_Chi_Minh" },
    generatedAt: "2026-10-18T03:00:00Z",
    cohort: { total: 0, completed: 0, everCompleted: 0, reopened: 0, reopenRate: null, legacyCalendarTickets: 0, firstResponse: { minutes: null, samples: 0 }, resolution: { minutes: null, samples: 0 } },
    daily: [{ date: '<img src=x onerror="alert(1)">', created: 0, completed: 0 }],
    backlog: [{ key: "unsafe", label: '<script>alert("x")</script>&', total: 0 }],
  });
  assert.ok(html.includes('lang="vi"'));
  assert.ok(html.includes("size: A4"));
  assert.ok(html.includes("Nhóm ticket tạo từ 2026-01-01 đến 2026-01-07"));
  assert.ok(html.includes("10:00"));
  assert.ok(html.includes("Chưa có ticket trong khoảng đã chọn."));
  assert.equal((html.match(/class="value">—</g) ?? []).length, 3);
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
});
