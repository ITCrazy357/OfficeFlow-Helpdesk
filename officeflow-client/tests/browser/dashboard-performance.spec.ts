import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page) {
  const state = { requests: [] as string[], failure: 0, empty: false };
  await page.route(/\/(?:backend-api|api)\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace(/^.*\/(?:backend-api|api)/, "");
    const headers = {
      "Access-Control-Allow-Origin": "http://localhost:3016",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    let data: unknown = [];
    if (endpoint === "/auth/refresh") data = { accessToken: "report-fixture" };
    else if (endpoint === "/auth/me")
      data = {
        id: 1,
        name: "Quản trị kiểm thử",
        email: "admin@example.test",
        role: "ADMIN",
        isActive: true,
        isLocked: false,
        mustChangePassword: false,
      };
    else if (endpoint === "/notifications/unread-count") data = 0;
    else if (endpoint === "/dashboard/performance") {
      state.requests.push(url.search);
      if (state.failure)
        return route.fulfill({
          status: state.failure,
          headers,
          json: {
            message:
              state.failure === 403
                ? "Không có quyền xem báo cáo"
                : "Báo cáo tạm thời không khả dụng",
          },
        });
      const from = url.searchParams.get("from")!;
      const to = url.searchParams.get("to")!;
      const daily = [];
      for (
        const day = new Date(from);
        day <= new Date(to);
        day.setUTCDate(day.getUTCDate() + 1)
      ) {
        daily.push({
          date: day.toISOString().slice(0, 10),
          created: !state.empty && daily.length === 0 ? 3 : 0,
          completed: !state.empty && daily.length === 0 ? 2 : 0,
        });
      }
      data = {
        range: { from, to, timezone: "Asia/Ho_Chi_Minh" },
        generatedAt: "2026-10-18T03:00:00Z",
        cohort: state.empty
          ? {
              total: 0,
              completed: 0,
              everCompleted: 0,
              reopened: 0,
              reopenRate: null,
              legacyCalendarTickets: 0,
              firstResponse: { minutes: null, samples: 0 },
              resolution: { minutes: null, samples: 0 },
            }
          : {
              total: 3,
              completed: 2,
              everCompleted: 3,
              reopened: 1,
              reopenRate: 33.33,
              legacyCalendarTickets: 1,
              firstResponse: { minutes: 60, samples: 1 },
              resolution: { minutes: 120, samples: 2 },
            },
        daily,
        backlog: [
          { key: "under-1", label: "Dưới 1 ngày", total: 0 },
          { key: "1-3", label: "1–dưới 3 ngày", total: state.empty ? 0 : 1 },
          { key: "3-7", label: "3–dưới 7 ngày", total: 0 },
          { key: "7-14", label: "7–dưới 14 ngày", total: 0 },
          { key: "14-plus", label: "Từ 14 ngày", total: state.empty ? 0 : 1 },
        ],
      };
    } else if (endpoint === "/dashboard/summary")
      data = {
        totalTickets: 3,
        openTickets: 1,
        inProgressTickets: 0,
        resolvedTickets: 1,
        closedTickets: 1,
        overdueTickets: 0,
      };
    else if (endpoint === "/dashboard/sla-overview")
      data = {
        totalTickets: 3,
        overdueTickets: 0,
        resolvedTickets: 1,
        overdueRate: 0,
      };
    else if (endpoint === "/dashboard/tickets-by-status")
      data = [
        { status: "OPEN", total: 1 },
        { status: "RESOLVED", total: 1 },
        { status: "CLOSED", total: 1 },
      ];
    else if (endpoint === "/tickets/workload")
      data = { items: [], unassignedTickets: 1 };
    else if (endpoint === "/tickets" || endpoint === "/notifications")
      data = {
        items: [],
        pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 1 },
      };
    await route.fulfill({ headers, json: { success: true, data } });
  });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Hiệu quả xử lý", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Phản hồi đầu tiên TB", { exact: true }),
  ).toBeVisible();
  return state;
}

test("filters, metrics, table alternatives and CSV use the same cohort", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = await fixture(page);
  const report = page.getByRole("region", {
    name: "Hiệu quả xử lý",
    exact: true,
  });
  for (const text of ["1 giờ", "2 giờ", "33,33%"])
    await expect(report.getByText(text, { exact: true })).toBeVisible();
  await expect(
    report.getByRole("figure", { name: "Tiến độ ticket theo ngày tạo" }),
  ).toBeVisible();
  await report.getByText("Xem bảng tiến độ", { exact: true }).click();
  await expect(
    report.getByRole("table", { name: "Tiến độ theo ngày tạo", exact: true }),
  ).toBeVisible();
  await report.getByText("Xem bảng tồn đọng", { exact: true }).click();
  await expect(
    report.getByRole("table", {
      name: "Tuổi ticket tồn đọng hiện tại",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Tạo từ ngày", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Đến ngày", { exact: true }).fill("2026-01-07");
  const beforeApply = state.requests.length;
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(
    report.getByText(/Nhóm tạo 2026-01-01 → 2026-01-07/),
  ).toBeVisible();
  expect(state.requests.length).toBe(beforeApply + 1);
  expect(state.requests.at(-1)).toContain("from=2026-01-01");
  expect(state.requests.at(-1)).toContain("to=2026-01-07");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(
    "officeflow-hieu-qua-2026-01-01-2026-01-07.csv",
  );
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain('"Phản hồi đầu tiên trung bình (phút SLA)",,"60","1"');
  expect(csv).toContain('"Tỷ lệ mở lại (%)",,"33.33","3"');
  await page.getByLabel("Tạo từ ngày", { exact: true }).fill("2026-01-08");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(report.getByRole("alert")).toContainText(
    "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc",
  );
  expect(state.requests.length).toBe(beforeApply + 1);
  expect(errors).toEqual([]);
});

test("temporary failures retain the captured report; denied access hides it", async ({
  page,
}) => {
  const state = await fixture(page);
  const report = page.getByRole("region", {
    name: "Hiệu quả xử lý",
    exact: true,
  });
  state.failure = 503;
  await page
    .getByRole("button", { name: "Làm mới báo cáo", exact: true })
    .click();
  await expect(report.getByRole("alert")).toContainText(
    "Đang giữ bản tải thành công trước đó",
    { timeout: 20000 },
  );
  await expect(report.getByText("33,33%", { exact: true })).toBeVisible();
  state.failure = 403;
  await page
    .getByRole("button", { name: "Thử lại báo cáo", exact: true })
    .click();
  await expect(report.getByRole("alert")).toContainText(
    "Không có quyền xem báo cáo",
    { timeout: 20000 },
  );
  await expect(report.getByText("33,33%", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Xuất CSV", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Xuất PDF", exact: true }),
  ).toBeDisabled();
  state.failure = 503;
  await page
    .getByRole("button", { name: "Thử lại báo cáo", exact: true })
    .click();
  await expect(report.getByRole("alert")).toContainText(
    "Báo cáo tạm thời không khả dụng",
    { timeout: 20000 },
  );
  await expect(report.getByText("33,33%", { exact: true })).toHaveCount(0);
  state.failure = 0;
  state.empty = true;
  await page
    .getByRole("button", { name: "Thử lại báo cáo", exact: true })
    .click();
  await expect(
    report.getByText("Chưa có ticket trong khoảng đã chọn.", { exact: true }),
  ).toBeVisible();
  await expect(
    report.getByText("Không có ticket tồn đọng.", { exact: true }),
  ).toBeVisible();
  await expect(report.getByText("—", { exact: true })).toHaveCount(3);
});

test("report fits mobile and desktop in both themes", async ({
  page,
}, testInfo) => {
  await fixture(page);
  const report = page.getByRole("region", {
    name: "Hiệu quả xử lý",
    exact: true,
  });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) =>
        document.documentElement.classList.toggle("dark", value === "dark"),
      theme,
    );
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(
        report.getByRole("figure", { name: "Ticket tồn đọng theo tuổi" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const dateWidth = await page
        .getByLabel("Tạo từ ngày", { exact: true })
        .evaluate((input) => input.getBoundingClientRect().width);
      expect(dateWidth).toBeGreaterThan(125);
      await report.screenshot({
        path: testInfo.outputPath(`performance-${theme}-${width}.png`),
        animations: "disabled",
      });
    }
  }
});

test("PDF prints the applied snapshot with Vietnamese text and paginates a full leap year", async ({
  page,
  context,
}, testInfo) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = "true";
    };
  });
  const state = await fixture(page);
  await page.getByLabel("Tạo từ ngày", { exact: true }).fill("2024-01-01");
  await page.getByLabel("Đến ngày", { exact: true }).fill("2024-12-31");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(
    page.getByText(/Nhóm tạo 2024-01-01 → 2024-12-31/),
  ).toBeVisible();
  // Edits not yet applied must not change the exported snapshot.
  await page.getByLabel("Tạo từ ngày", { exact: true }).fill("2026-01-01");
  const requests = state.requests.length;
  await page.getByRole("button", { name: "Xuất PDF", exact: true }).click();
  const frameElement = page.locator(
    'iframe[title="Bản PDF báo cáo hiệu quả xử lý"]',
  );
  const frame = await frameElement.contentFrame();
  await expect(frame.locator("html")).toHaveAttribute(
    "data-print-requested",
    "true",
  );
  await expect(
    frame.getByRole("heading", { name: "Báo cáo hiệu quả xử lý", exact: true }),
  ).toBeAttached();
  await expect(
    frame.getByText("Nhóm ticket tạo từ 2024-01-01 đến 2024-12-31", {
      exact: true,
    }),
  ).toBeAttached();
  await expect(frame.getByText("1 giờ", { exact: true })).toBeAttached();
  await expect(frame.getByText("33,33%", { exact: true })).toBeAttached();
  await expect(
    frame
      .getByRole("table", { name: "Tiến độ theo ngày tạo", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(366);
  expect(state.requests.length).toBe(requests);
  const printFrame = await (await frameElement.elementHandle())!.contentFrame();
  const printHtml = await printFrame!.content();
  await page.evaluate(() =>
    document
      .querySelector<HTMLIFrameElement>(
        'iframe[title="Bản PDF báo cáo hiệu quả xử lý"]',
      )
      ?.contentWindow?.dispatchEvent(new Event("afterprint")),
  );
  await expect(frameElement).toHaveCount(0);
  const printPage = await context.newPage();
  await printPage.setViewportSize({ width: 794, height: 1123 });
  await printPage.setContent(printHtml);
  await printPage.emulateMedia({ media: "print" });
  await printPage.screenshot({
    path: testInfo.outputPath("performance-print-a4.png"),
  });
  const pdf = await printPage.pdf({
    path: testInfo.outputPath("performance-2024.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(
    (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,
  ).toBeGreaterThan(3);
  expect(pdf.toString("latin1")).toMatch(
    /\/MediaBox\s*\[0 0 59\d(?:\.\d+)? 84\d(?:\.\d+)?\]/,
  );
  await printPage.close();
});
