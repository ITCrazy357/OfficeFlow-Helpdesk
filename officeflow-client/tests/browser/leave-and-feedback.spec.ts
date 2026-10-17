import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page, role = "EMPLOYEE") {
  const me = {
    id: 1,
    name: "Người kiểm thử",
    email: "user@example.test",
    role,
    departmentId: 7,
    department: { id: 7, name: "Vận hành" },
    isActive: true,
    isLocked: false,
    mustChangePassword: false,
  };
  const state = {
    balance: {
      userId: 1,
      year: 2035,
      allowance: null as number | null,
      used: 0,
      reserved: 0,
      remaining: null as number | null,
      version: 0,
      legacyRequests: 1,
    },
    ticket: {
      id: 5,
      title: "Sửa kết nối VPN",
      description: "Không truy cập được mạng nội bộ",
      status: "RESOLVED",
      priority: "MEDIUM",
      createdBy: { ...me, id: 1 },
      assignedTo: { id: 3, name: "Đội IT", email: "it@example.test" },
      resolutionVersion: 1,
      resolveAt: "2026-10-18T08:00:00Z",
      createdAt: "2026-10-18T07:00:00Z",
      updatedAt: "2026-10-18T08:00:00Z",
      category: null,
      asset: null,
    },
    rating: null as { score: number; comment: string | null } | null,
    writes: [] as { path: string; input: Record<string, unknown> }[],
    stale: false,
    failCalendar: false,
  };
  await page.route(/\/(?:backend-api|api)\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/(?:backend-api|api)/, "");
    let data: unknown = [];
    const fail = (status: number, message: string) =>
      route.fulfill({ status, json: { message } });
    if (path === "/auth/refresh")
      data = { accessToken: "leave-result-fixture" };
    else if (path === "/auth/me") data = me;
    else if (path === "/notifications/unread-count") data = 0;
    else if (path === "/departments")
      data = [
        { id: 7, name: "Vận hành" },
        { id: 8, name: "Kỹ thuật" },
      ];
    else if (path === "/users")
      data = [me, { ...me, id: 2, name: "Đồng nghiệp" }];
    else if (path === "/leave-request/balance")
      data = {
        ...state.balance,
        userId: Number(url.searchParams.get("userId")) || 1,
        year: Number(url.searchParams.get("year")),
      };
    else if (path.startsWith("/leave-request/entitlements/")) {
      const input = request.postDataJSON();
      state.writes.push({ path, input });
      state.balance.allowance = input.days;
      state.balance.remaining = input.days;
      state.balance.version++;
      data = state.balance;
    } else if (path === "/leave-request/calendar") {
      if (state.failCalendar) return fail(503, "Lỗi tải lịch tạm thời");
      const item = (id: number, period: string, status: string) => ({
        id,
        requester: { id, name: `Đồng nghiệp ${id}` },
        period,
        status,
        startDate: "2035-01-08",
        endDate: "2035-01-08",
        days: [{ date: "2035-01-08", halfDays: period === "FULL_DAY" ? 2 : 1 }],
      });
      data = {
        departmentId: 7,
        page: 1,
        totalPages: 1,
        totalItems: 3,
        items: [
          item(1, "MORNING", "APPROVED"),
          item(2, "AFTERNOON", "APPROVED"),
          item(3, "MORNING", "PENDING"),
        ],
      };
    } else if (path === "/leave-request/preview") {
      const input = request.postDataJSON();
      data = {
        days: input.period === "FULL_DAY" ? 1 : 0.5,
        calendar: {
          timezone: "Asia/Ho_Chi_Minh",
          workingDays: [1, 2, 3, 4, 5],
          holidays: [],
        },
        balances: [state.balance],
      };
    } else if (
      [
        "/leave-request/me",
        "/leave-request/pending-approval",
        "/notifications",
      ].includes(path)
    )
      data = {
        items: [],
        pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
      };
    else if (path === "/leave-request" && request.method() === "POST") {
      const input = request.postDataJSON();
      state.writes.push({ path, input });
      return fail(409, "Leave request overlaps with an existing request");
    } else if (path === "/tickets/5") data = state.ticket;
    else if (path === "/tickets/5/feedback" && request.method() === "GET")
      data = state.rating;
    else if (/^\/tickets\/5\/(confirm|reopen|feedback)$/.test(path)) {
      const input = request.postDataJSON();
      state.writes.push({ path, input });
      if (state.stale) {
        state.stale = false;
        state.ticket.resolutionVersion++;
        return fail(409, "Ticket result changed. Reload before responding");
      }
      if (path.endsWith("/confirm")) state.ticket.status = "CLOSED";
      if (path.endsWith("/reopen")) state.ticket.status = "IN_PROGRESS";
      if (path.endsWith("/feedback"))
        state.rating = { score: input.score, comment: input.comment ?? null };
      data = state.rating ?? state.ticket;
    }
    await route.fulfill({ json: { success: true, data } });
  });
  return state;
}

test("annual balance distinguishes unknown values; ADMIN saves a half-day allowance with its version", async ({
  page,
}) => {
  const state = await fixture(page, "ADMIN");
  await page.goto("/leave-requests");
  await page.getByLabel("Năm", { exact: true }).fill("2035");
  await expect(page.getByText("Chưa cấu hình", { exact: true })).toHaveCount(2);
  await page.getByLabel("Hạn mức phép năm 2035 (ngày)").fill("12.5");
  await page.getByRole("button", { name: "Lưu hạn mức" }).click();
  await expect(page.getByText("Đã lưu hạn mức.")).toBeVisible();
  expect(state.writes[0]).toEqual({
    path: "/leave-request/entitlements/1",
    input: { days: 12.5, version: 0 },
  });
  await expect(page.getByText("12.5 ngày", { exact: true })).toHaveCount(2);
});

test("department calendar shows half-day conflicts and retries errors; employees cannot edit allowances", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/leave-requests");
  await expect(page.getByRole("button", { name: "Lưu hạn mức" })).toHaveCount(
    0,
  );
  await page.getByLabel("Tháng", { exact: true }).fill("2035-01");
  await page
    .getByRole("button", {
      name: "08/01/2035: 3 người nghỉ, 2 người trùng buổi",
    })
    .click();
  await expect(page.getByText(/Có 2 người nghỉ trùng buổi/)).toBeVisible();
  await expect(
    page.getByText("Buổi chiều · Đã duyệt", { exact: true }),
  ).toBeVisible();
  state.failCalendar = true;
  await page.getByLabel("Tháng", { exact: true }).fill("2035-02");
  await expect(
    page.getByRole("button", { name: "Tải lại lịch" }),
  ).toBeVisible();
  state.failCalendar = false;
  await page.getByRole("button", { name: "Tải lại lịch" }).click();
  await expect(page.getByRole("button", { name: "Tải lại lịch" })).toHaveCount(
    0,
  );
});

test("leave form previews working units and retains the reason after a server conflict", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/leave-requests/new");
  await page
    .getByRole("combobox", { name: "Loại nghỉ" })
    .selectOption("UNPAID");
  await page
    .getByRole("combobox", { name: "Thời gian nghỉ" })
    .selectOption("MORNING");
  await page.getByLabel("Ngày bắt đầu", { exact: true }).fill("2035-01-08");
  await page.getByLabel("Ngày kết thúc", { exact: true }).fill("2035-01-08");
  await expect(page.getByText("Thời lượng: 0.5 ngày công")).toBeVisible();
  await page
    .getByLabel("Lý do nghỉ", { exact: true })
    .fill("Lý do riêng tư <script>alert(1)</script>");
  await page.getByRole("button", { name: "Gửi đơn nghỉ" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Khoảng nghỉ này trùng" }),
  ).toBeVisible();
  await expect(page.getByLabel("Lý do nghỉ", { exact: true })).toHaveValue(
    "Lý do riêng tư <script>alert(1)</script>",
  );
  expect(state.writes[0].input).toMatchObject({
    type: "UNPAID",
    period: "MORNING",
  });
});

test("requester confirms the result and submits a single low rating with a required reason", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/tickets/5");
  await page.getByRole("button", { name: "Xác nhận đã giải quyết" }).click();
  await expect(
    page.getByRole("form", { name: "Đánh giá hỗ trợ" }),
  ).toBeVisible();
  await page.getByText("2 sao", { exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "2 sao", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Gửi đánh giá" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "cần lý do" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  await page
    .getByLabel("Nhận xét (bắt buộc)")
    .fill("Cần hướng dẫn rõ hơn <script>");
  await page.getByRole("button", { name: "Gửi đánh giá" }).click();
  await expect(page.getByText("Đánh giá: 2/5 sao")).toBeVisible();
  await expect(
    page.getByText("Cần hướng dẫn rõ hơn <script>", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi đánh giá" })).toHaveCount(
    0,
  );
  expect(state.writes).toEqual([
    { path: "/tickets/5/confirm", input: { resolutionVersion: 1 } },
    {
      path: "/tickets/5/feedback",
      input: { score: 2, comment: "Cần hướng dẫn rõ hơn <script>" },
    },
  ]);
});

test("stale result retains a reopen draft; a different user cannot confirm the result", async ({
  page,
}) => {
  const state = await fixture(page);
  state.stale = true;
  await page.goto("/tickets/5");
  await page
    .getByLabel("Vẫn cần hỗ trợ? Nêu lý do")
    .fill("VPN vẫn không kết nối");
  await page.getByRole("button", { name: "Yêu cầu xử lý tiếp" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Kết quả ticket đã thay đổi" }),
  ).toBeVisible();
  await expect(page.getByLabel("Vẫn cần hỗ trợ? Nêu lý do")).toHaveValue(
    "VPN vẫn không kết nối",
  );
  await page.getByRole("button", { name: "Yêu cầu xử lý tiếp" }).click();
  await expect(
    page.getByRole("button", { name: "Yêu cầu xử lý tiếp" }),
  ).toHaveCount(0);
  expect(state.writes[1].input.resolutionVersion).toBe(2);
  state.ticket.status = "RESOLVED";
  state.ticket.createdBy.id = 9;
  await page.reload();
  await expect(page.getByText("Đang chờ người gửi xác nhận.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác nhận đã giải quyết" }),
  ).toHaveCount(0);
});

test("calendar and ticket result fit mobile and desktop in both themes", async ({
  page,
}) => {
  await fixture(page, "ADMIN");
  await page.addInitScript(() =>
    localStorage.setItem("officeflow-theme", "dark"),
  );
  for (const theme of ["dark", "light"]) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      for (const path of ["/leave-requests", "/tickets/5"]) {
        await page.goto(path);
        await page.evaluate((theme) => {
          document.documentElement.classList.toggle("dark", theme === "dark");
        }, theme);
        await page.waitForLoadState("networkidle");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBe(true);
      }
    }
  }
});
